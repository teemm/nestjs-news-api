import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { MAX_IMAGE_SIZE_BYTES, removeImageByUrl } from '../config/multer.config';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  method: string;
  timestamp: string;
}

interface NormalizedError {
  status: HttpStatus;
  message: string | string[];
  error?: string;
}

/**
 * Single source of truth for error responses.
 * Maps HttpExceptions, Prisma errors and unknown throwables onto one shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { file?: Express.Multer.File }>();
    const response = ctx.getResponse<Response>();

    const normalized = this.normalize(exception);

    // A failed multipart request has already written its file to disk — clean it up.
    if (request.file?.filename) {
      removeImageByUrl(request.file.filename);
    }

    const body: ErrorResponseBody = {
      statusCode: normalized.status,
      error: normalized.error ?? this.statusText(normalized.status),
      message: normalized.message,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${normalized.status}: ${JSON.stringify(normalized.message)}`,
      );
    }

    httpAdapter.reply(response, body, normalized.status);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnownError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'The request could not be processed: invalid data was sent to the database.',
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database connection is unavailable. Please try again later.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus() as HttpStatus;

    // Multer reports an oversized upload as 413; the API contract asks for 400.
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: `File is too large. The maximum allowed size is ${Math.round(
          MAX_IMAGE_SIZE_BYTES / (1024 * 1024),
        )} MB.`,
      };
    }

    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { status, message: payload };
    }

    const record = payload as Record<string, unknown>;
    const message = (record.message ?? exception.message) as string | string[];
    const error = typeof record.error === 'string' ? record.error : undefined;

    return { status, message, error };
  }

  private fromPrismaKnownError(exception: Prisma.PrismaClientKnownRequestError): NormalizedError {
    const target = this.formatTarget(exception.meta?.target);

    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: target
            ? `A record with this ${target} already exists.`
            : 'A record with these unique values already exists.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'The requested record was not found.',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'The referenced record does not exist.',
        };
      case 'P2023':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Malformed identifier: expected a 24-character hexadecimal ObjectId.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Database error (${exception.code}).`,
        };
    }
  }

  /**
   * Prisma reports the conflicting fields differently per connector:
   * SQL gives `['email']`, MongoDB gives the index name `users_email_key`.
   * Both are reduced to a readable field list.
   */
  private formatTarget(target: unknown): string | undefined {
    const raw = Array.isArray(target)
      ? target.map((item) => String(item))
      : typeof target === 'string'
        ? [target]
        : [];

    const fields = raw.map((entry) => {
      const indexName = /^.+?_(.+)_key$/.exec(entry);
      return indexName ? indexName[1].split('_').join(' + ') : entry;
    });

    return fields.length > 0 ? fields.join(', ') : undefined;
  }

  private statusText(status: HttpStatus): string {
    const name = Object.entries(HttpStatus).find(([, value]) => value === status)?.[0];
    return name
      ? name
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'Error';
  }
}
