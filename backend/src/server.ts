import { app } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`  ScriptSense TypeScript/Node.js API Server Online`);
  console.log(`  Listening at: http://${HOST}:${PORT}`);
  console.log(`  Health check: http://${HOST}:${PORT}/`);
  console.log(`======================================================\n`);
});
