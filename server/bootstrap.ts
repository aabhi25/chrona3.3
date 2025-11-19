import { storage } from "./storage";
import { hashPassword } from "./auth";
import { seedSystemModules } from "./seedModules";

/**
 * Bootstrap script to create the initial Super Admin user and seed system modules
 * This script should be run once during initial setup
 */
export async function createSuperAdmin() {
  // Seed system modules FIRST (always runs, regardless of admin existence)
  try {
    console.log("📦 Seeding system modules...");
    const result = await seedSystemModules();
    console.log(`✅ Modules seeded: ${result.inserted} inserted, ${result.skipped} skipped`);
  } catch (error) {
    console.error("❌ Failed to seed system modules:", error);
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    console.log("\n⚠️  Super Admin credentials not provided in environment variables");
    console.log("   Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create initial admin");
    return;
  }

  try {
    // Check if super admin already exists
    const existingAdmin = await storage.getUserByEmail(superAdminEmail);
    if (existingAdmin) {
      console.log("\n✅ Super Admin already exists");
      return;
    }

    // Create the super admin user
    const hashedPassword = await hashPassword(superAdminPassword);
    const superAdmin = await storage.createUser({
      email: superAdminEmail,
      loginId: superAdminEmail, // Use email as loginId for super admin
      passwordHash: hashedPassword,
      role: "super_admin",
      firstName: "Super",
      lastName: "Admin",
      schoolId: null, // Super admins don't belong to a specific school
      teacherId: null,
      studentId: null,
      parentId: null
    });

    console.log("\n🎉 Super Admin created successfully!");
    console.log(`   Email: ${superAdmin.email}`);
    console.log("   You can now login with these credentials");
  } catch (error) {
    console.error("❌ Failed to create Super Admin:", error);
  }
}