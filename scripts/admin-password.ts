/**
 * Creates the admin password: a random one (printed once) and its hash for ADMIN_PASSWORD_HASH.
 *
 *   npm run admin:password
 *
 * Put the password in your password manager and the hash in .env (locally) or the server's .env.
 * Neither belongs in git.
 */
import { randomBytes } from "node:crypto";
import { hashAdminPassword } from "@/domain/admin/admin-password";

const password = randomBytes(24).toString("base64url");
console.log(`Admin password (save it in your password manager; it is not stored anywhere):
  ${password}

Add this line to .env (local) or /opt/political-views/.env (server), then restart the app:
  ADMIN_PASSWORD_HASH=${hashAdminPassword(password)}`);
