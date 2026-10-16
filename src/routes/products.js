const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { cache, clearCache } = require('../middleware/cache');

const prisma = new PrismaClient();

// GET /api/products?page=1&limit=10&sort=price|createdAt|rating|name&order=asc|desc
//                 &category=Books&minPrice=100&maxPrice=5000&search=pro
router.get('/', cache(60), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const sortField = ['price', 'createdAt', 'rating', 'name'].includes(req.query.sort) ? req.query.sort : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const where = {};
    if (req.query.category) where.category = { equals: req.query.category, mode: 'insensitive' };
    if (req.query.minPrice || req.query.maxPrice) {
      where.price = {};
      if (req.query.minPrice) where.price.gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) where.price.lte = parseFloat(req.query.maxPrice);
    }
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { description: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit; // offset
    const [total, data] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({ where, orderBy: { [sortField]: order }, skip, take: limit })
    ]);

    res.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), sort: sortField, order }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/categories', cache(300), async (req, res) => {
  const rows = await prisma.product.groupBy({ by: ['category'], _count: { _all: true } });
  res.json(rows.map((r) => ({ category: r.category, count: r._count._all })));
});

// POST /api/products  -> add product & invalidate cache
router.post('/', async (req, res) => {
  const { name, description = '', category, price, rating } = req.body || {};
  if (!name || !category || price == null) return res.status(400).json({ error: 'name, category, price required' });
  const product = await prisma.product.create({
    data: { name, description, category, price: Number(price), rating: rating ? Number(rating) : 4 }
  });
  const cleared = await clearCache();
  res.status(201).json({ product, cacheKeysCleared: cleared });
});

module.exports = router;
