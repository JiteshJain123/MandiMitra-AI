import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { LANGUAGE_CODES, USER_ROLES, type PublicUser } from '@mandimitra/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'farmer', required: true },
    preferredLanguage: { type: String, enum: LANGUAGE_CODES, default: 'hi', required: true },
    saveTranscriptsByDefault: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false, index: true },
    /** Incremented on logout to invalidate all previously issued tokens. */
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    preferredLanguage: u.preferredLanguage,
    saveTranscriptsByDefault: u.saveTranscriptsByDefault,
    isDemo: u.isDemo,
  };
}
