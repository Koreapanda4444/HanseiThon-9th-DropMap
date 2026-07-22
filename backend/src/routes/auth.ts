import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  currentAccount,
  expiredSessionCookie,
  login,
  logout,
  register,
  sessionCookie,
} from "../services/auth-service.js";

const email = z.string().trim().email().max(254);
const password = z.string().min(8).max(72);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(30),
  email,
  password,
});
const loginSchema = z.object({ email, password });

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const result = await register(registerSchema.parse(request.body));
    reply.header("Set-Cookie", sessionCookie(result.token));
    return reply.status(201).send({ user: result.account });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const result = await login(loginSchema.parse(request.body));
    reply.header("Set-Cookie", sessionCookie(result.token));
    return { user: result.account };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await logout(request);
    reply.header("Set-Cookie", expiredSessionCookie());
    return reply.status(204).send();
  });

  app.get("/api/auth/me", async (request) => ({ user: await currentAccount(request) }));
}
