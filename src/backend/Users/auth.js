const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

// Authenticate user by email and password
async function checkUserCredentials(email, password) {
  // Default admin logic
  if (email === "admin@gmail.com" && password === "admin123") {
    return {
      id: 0,
      email: "admin@gmail.com",
      role: "admin",
      createdAt: new Date(),
      isDefault: true,
    };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return false;
  const match = await bcrypt.compare(password, user.password);
  return match ? user : false;
}

// Register a new user with email, password, and role
async function registerUser(email, password, role) {
  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, message: "Email already registered" };
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, role },
  });
  return { success: true, user };
}

async function getAllUsers() {
  try {
    const users = await prisma.user.findMany();
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkUserCredentials,
  registerUser,
  getAllUsers,
};
