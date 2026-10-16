require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const catalog = {
  Electronics: ['Wireless Earbuds', 'Smart Watch', 'Bluetooth Speaker', 'Power Bank', 'Gaming Mouse', 'Mechanical Keyboard', 'Webcam HD', 'USB-C Hub'],
  Fashion: ['Denim Jacket', 'Running Shoes', 'Cotton T-Shirt', 'Leather Wallet', 'Sunglasses', 'Backpack', 'Hoodie', 'Analog Watch'],
  Home: ['Table Lamp', 'Coffee Maker', 'Air Purifier', 'Wall Clock', 'Bedsheet Set', 'Cushion Cover', 'Storage Box', 'Desk Organizer'],
  Books: ['Clean Code', 'Atomic Habits', 'Node.js Design Patterns', 'System Design Basics', 'Deep Work', 'The Pragmatic Programmer'],
  Sports: ['Yoga Mat', 'Dumbbell Set', 'Football', 'Cricket Bat', 'Skipping Rope', 'Water Bottle']
};

async function main() {
  await prisma.product.deleteMany();
  const rows = [];
  let day = 0;
  for (const [category, names] of Object.entries(catalog)) {
    for (const base of names) {
      for (const tier of ['Lite', 'Pro']) {
        day++;
        rows.push({
          name: `${base} ${tier}`,
          description: `${tier} edition of ${base}. Quality ${category.toLowerCase()} product for everyday use.`,
          category,
          price: Math.round((199 + Math.random() * 9800) * 100) / 100,
          rating: Math.round((3 + Math.random() * 2) * 10) / 10,
          createdAt: new Date(Date.now() - day * 86400000)
        });
      }
    }
  }
  await prisma.product.createMany({ data: rows });
  console.log(`Seeded ${rows.length} products`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
