/** Creates (or resets) the synthetic demo account. Usage: npm run seed:demo */
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db.js';
import { getOrCreateDemoUser, resetDemoData } from '../services/demo.service.js';

await connectDb(env().MONGODB_URI);
const user = await getOrCreateDemoUser();
await resetDemoData(user);
console.log(`Demo account ready: ${user.email} (sign in with the "Try demo" button)`);
await disconnectDb();
