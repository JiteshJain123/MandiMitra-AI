import mongoose from 'mongoose';

// User input is parsed by Zod into primitives before it reaches any query, so operator
// injection ({"$ne": ...}) is not possible. (Mongoose sanitizeFilter is not used because it
// would also neutralise the server-built $in/$gte filters.)
mongoose.set('strictQuery', true);

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
