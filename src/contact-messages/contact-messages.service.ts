import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactMessage } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(unreadOnly = false): Promise<ContactMessage[]> {
    return this.prisma.contactMessage.findMany({
      where: unreadOnly ? { read: false } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  countUnread(): Promise<number> {
    return this.prisma.contactMessage.count({ where: { read: false } });
  }

  async create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    const id = randomBytes(12).toString('hex');
    const createdAt = new Date();
    const item: ContactMessage = { id, ...dto, read: false, createdAt };
    await this.prisma.$runCommandRaw({
      insert: 'contact_messages',
      documents: [{ _id: { $oid: id }, ...dto, read: false, createdAt: { $date: createdAt.toISOString() } }],
    });
    return item;
  }

  async setRead(id: string, read: boolean): Promise<ContactMessage> {
    await this.findByIdOrFail(id);
    await this.prisma.$runCommandRaw({
      update: 'contact_messages',
      updates: [{ q: { _id: { $oid: id } }, u: { $set: { read } } }],
    });
    return this.findByIdOrFail(id);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.findByIdOrFail(id);
    await this.prisma.$runCommandRaw({
      delete: 'contact_messages',
      deletes: [{ q: { _id: { $oid: id } }, limit: 1 }],
    });
    return { id, deleted: true };
  }

  private async findByIdOrFail(id: string): Promise<ContactMessage> {
    const item = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Contact message not found');
    return item;
  }
}
