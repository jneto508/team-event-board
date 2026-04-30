

// import { type PrismaClient, type User as PrismaUser } from "../generated/prisma/client";
// import { Err, Ok, type Result } from "../lib/result";
// import type { AuthError } from "./errors";
// import {
//   ProtectedUserOperation,
//   UnexpectedDependencyError,
//   UserAlreadyExists,
//   UserNotFound,
// } from "./errors";
// import type { IUserRecord, UserRole } from "./User";
// import type { IUserRepository } from "./UserRepository";

// function toUserRecord(row: PrismaUser): IUserRecord {
//   return {
//     id: row.id,
//     email: row.email,
//     displayName: row.displayName,
//     role: row.role as UserRole,
//     passwordHash: row.passwordHash,
//   };
// }

// class PrismaUserRepository implements IUserRepository {
//   constructor(private readonly prisma: PrismaClient) {}

//   async findByEmail(email: string): Promise<Result<IUserRecord | null, AuthError>> {
//     try {
//       const row = await this.prisma.user.findUnique({
//         where: { email },
//       });

//       return Ok(row ? toUserRecord(row) : null);
//     } catch {
//       return Err(UnexpectedDependencyError("Failed to load user by email."));
//     }
//   }

//   async findById(id: string): Promise<Result<IUserRecord | null, AuthError>> {
//     try {
//       const row = await this.prisma.user.findUnique({
//         where: { id },
//       });

//       return Ok(row ? toUserRecord(row) : null);
//     } catch {
//       return Err(UnexpectedDependencyError("Failed to load user by id."));
//     }
//   }

//   async listUsers(): Promise<Result<IUserRecord[], AuthError>> {
//     try {
//       const rows = await this.prisma.user.findMany({
//         orderBy: { displayName: "asc" },
//       });

//       return Ok(rows.map(toUserRecord));
//     } catch {
//       return Err(UnexpectedDependencyError("Failed to list users."));
//     }
//   }

//   async createUser(user: IUserRecord): Promise<Result<IUserRecord, AuthError>> {
//     try {
//       const existing = await this.prisma.user.findUnique({
//         where: { email: user.email },
//       });

//       if (existing) {
//         return Err(UserAlreadyExists("A user with this email already exists."));
//       }

//       const row = await this.prisma.user.create({
//         data: {
//           id: user.id,
//           email: user.email,
//           displayName: user.displayName,
//           role: user.role,
//           passwordHash: user.passwordHash,
//         },
//       });

//       return Ok(toUserRecord(row));
//     } catch {
//       return Err(UnexpectedDependencyError("Failed to create user."));
//     }
//   }

//   async deleteUser(id: string): Promise<Result<boolean, AuthError>> {
//     try {
//       const user = await this.prisma.user.findUnique({
//         where: { id },
//       });

//       if (!user) {
//         return Err(UserNotFound(`User ${id} was not found.`));
//       }

//       if (user.role === "admin") {
//         return Err(ProtectedUserOperation("Admin users cannot be deleted."));
//       }

//       await this.prisma.user.delete({
//         where: { id },
//       });

//       return Ok(true);
//     } catch {
//       return Err(UnexpectedDependencyError("Failed to delete user."));
//     }
//   }
// }

// export function CreatePrismaUserRepository(prisma: PrismaClient): IUserRepository {
//   return new PrismaUserRepository(prisma);
// }