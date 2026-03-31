import { pgTable, text, timestamp, boolean, varchar, jsonb, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('operator'),
  passwordHash: text('password_hash').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jid: varchar('jid', { length: 50 }).notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  name: varchar('name', { length: 255 }),
  pushName: varchar('push_name', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chats.id),
  contactJid: varchar('contact_jid', { length: 50 }).notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  type: varchar('type', { length: 20 }).notNull().default('text'),
  direction: varchar('direction', { length: 10 }).notNull(),
  text: text('text'),
  mediaUrl: text('media_url'),
  mimetype: varchar('mimetype', { length: 100 }),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').notNull().default({}),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id).unique(),
  status: varchar('status', { length: 20 }).notNull().default('disconnected'),
  qrCode: text('qr_code'),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
})

export const agentAnalysis = pgTable('agent_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id),
  agentName: varchar('agent_name', { length: 50 }).notNull(),
  decision: varchar('decision', { length: 20 }).notNull(),
  analysis: jsonb('analysis').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
