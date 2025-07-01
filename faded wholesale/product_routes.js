const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const adminAuthMiddleware = require('../middleware/adminAuth');
const SyncService = require('../services/syncService');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation middleware
const validateProduct = [
  body('grade')
    .isIn(['A-GRADE', 'B-GRADE', 'ROSIN', 'VAPE', 'BULK'])
    .withMessage('Invalid grade'),
  body('strain')
    .notEmpty()
    .withMessage('Strain is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Strain must be between 1 and 255 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('thca')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('THCA must be between 0 and 100'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('status')
    .isIn(['AVAILABLE', 'COMING SOON', 'SOLD OUT'])
    .withMessage('Invalid status'),
  body('type')
    .isIn(['Indica', 'Sativa', 'Hybrid', 'Concentrate'])
    .withMessage('Invalid type'),
  body('costBasis')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost basis must be a positive number'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
];

const validateQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Search term too long'),
  query('grade')
    .optional()
    .isIn(['A-GRADE', 'B-GRADE', 'ROSIN', 'VAPE', 'BULK'])
    .withMessage('Invalid grade filter'),
  query('status')
    .optional()
    .isIn(['AVAILABLE', 'COMING SOON', 'SOLD OUT'])
    .withMessage('Invalid status filter')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Helper function to process uploaded image
const processImage = async (buffer, filename) => {
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Process image with sharp
    const processedImage = await sharp(buffer)
      .resize(400, 400, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Save to disk
    const imagePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(imagePath, processedImage);
    
    // Return public URL
    return `/uploads/products/${filename}`;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

// GET /api/products - List all products with filtering and pagination
router.get('/', validateQuery, handleValidationErrors, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      grade,
      status,
      type,
      available,
      featured,
      sortBy = 'strain',
      sortOrder = 'ASC'
    } = req.query;
    
    // Build where clause
    const where = {};
    
    if (search) {
      where.strain = {
        [Product.sequelize.Sequelize.Op.like]: `%${search}%`
      };
    }
    
    if (grade) where.grade = grade;
    if (status) where.status = status;
    if (type) where.type = type;
    if (featured !== undefined) where.featured = featured === 'true';
    
    if (available === 'true') {
      where.status = 'AVAILABLE';
      where.stock = {
        [Product.sequelize.Sequelize.Op.gt]: 0
      };
    }
    
    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Valid sort fields
    const validSortFields = ['strain', 'price', 'stock', 'grade', 'thca', 'createdAt', 'sortOrder'];
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'strain';
    const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    // Query products
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[orderBy, orderDirection]],
      distinct: true
    });
    
    // Hide cost basis for non-admin users
    if (req.user.role !== 'admin') {
      rows.forEach(product => {
        product.hideInternal = true;
      });
    }
    
    res.json({
      success: true,
      data: {
        products: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNext: offset + parseInt(limit) < count,
          hasPrev: parseInt(page) > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

// GET /api/products/stats - Get product statistics (admin only)
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const stats = await Product.getInventoryStats();
    
    // Additional stats for admin
    const [
      lowStockProducts,
      recentlyModified,
      topGrades,
      priceRanges
    ] = await Promise.all([
      Product.findLowStock(10),
      Product.findAll({
        where: {
          lastModified: {
            [Product.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        order: [['lastModified', 'DESC']],
        limit: 10
      }),
      Product.findAll({
        attributes: [
          'grade',
          [Product.sequelize.Sequelize.fn('COUNT', Product.sequelize.Sequelize.col('grade')), 'count'],
          [Product.sequelize.Sequelize.fn('AVG', Product.sequelize.Sequelize.col('price')), 'avgPrice']
        ],
        group: ['grade'],
        raw: true
      }),
      Product.findAll({
        attributes: [
          [Product.sequelize.Sequelize.fn('MIN', Product.sequelize.Sequelize.col('price')), 'minPrice'],
          [Product.sequelize.Sequelize.fn('MAX', Product.sequelize.Sequelize.col('price')), 'maxPrice'],
          [Product.sequelize.Sequelize.fn('AVG', Product.sequelize.Sequelize.col('price')), 'avgPrice']
        ],
        raw: true
      })
    ]);
    
    res.json({
      success: true,
      data: {
        ...stats,
        lowStockProducts: lowStockProducts.length,
        recentlyModified: recentlyModified.length,
        gradeBreakdown: topGrades.reduce((acc, item) => {
          acc[item.grade] = {
            count: parseInt(item.count),
            avgPrice: parseFloat(item.avgPrice || 0)
          };
          return acc;
        }, {}),
        priceRange: {
          min: parseFloat(priceRanges[0]?.minPrice || 0),
          max: parseFloat(priceRanges[0]?.maxPrice || 0),
          avg: parseFloat(priceRanges[0]?.avgPrice || 0)
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({
      error: 'Failed to fetch product statistics',
      message: error.message
    });
  }
});

// GET /api/products/available - Get only available products
router.get('/available', async (req, res) => {
  try {
    const products = await Product.findAvailable({
      order: [['featured', 'DESC'], ['sortOrder', 'ASC'], ['strain', 'ASC']]
    });
    
    // Hide cost basis for non-admin users
    if (req.user.role !== 'admin') {
      products.forEach(product => {
        product.hideInternal = true;
      });
    }
    
    res.json({
      success: true,
      data: { products }
    });
    
  } catch (error) {
    console.error('Error fetching available products:', error);
    res.status(500).json({
      error: 'Failed to fetch available products',
      message: error.message
    });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', 
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }
      
      // Hide cost basis for non-admin users
      if (req.user.role !== 'admin') {
        product.hideInternal = true;
      }
      
      res.json({
        success: true,
        data: { product }
      });
      
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({
        error: 'Failed to fetch product',
        message: error.message
      });
    }
  }
);

// POST /api/products - Create new product (admin only)
router.post('/',
  adminAuthMiddleware,
  upload.single('photo'),
  validateProduct,
  handleValidationErrors,
  async (req, res) => {
    try {
      const productData = {
        ...req.body,
        modifiedBy: req.user.email
      };
      
      // Process uploaded image if present
      if (req.file) {
        const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        productData.photo = await processImage(req.file.buffer, filename);
      }
      
      const product = await Product.create(productData);
      
      // Broadcast update to all connected clients
      await SyncService.broadcastProductUpdate('create', product);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product }
      });
      
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({
        error: 'Failed to create product',
        message: error.message
      });
    }
  }
);

// PUT /api/products/:id - Update product (admin only)
router.put('/:id',
  adminAuthMiddleware,
  upload.single('photo'),
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  validateProduct,
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }
      
      const updateData = {
        ...req.body,
        modifiedBy: req.user.email
      };
      
      // Process uploaded image if present
      if (req.file) {
        const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        updateData.photo = await processImage(req.file.buffer, filename);
        
        // Clean up old image
        if (product.photo && product.photo.startsWith('/uploads/')) {
          const oldImagePath = path.join(__dirname, '..', 'public', product.photo);
          try {
            await fs.promises.unlink(oldImagePath);
          } catch (error) {
            console.warn('Failed to delete old image:', error.message);
          }
        }
      }
      
      await product.update(updateData);
      
      // Broadcast update to all connected clients
      await SyncService.broadcastProductUpdate('update', product);
      
      res.json({
        success: true,
        message: 'Product updated successfully',
        data: { product }
      });
      
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({
        error: 'Failed to update product',
        message: error.message
      });
    }
  }
);

// PATCH /api/products/:id/stock - Update product stock (admin only)
router.patch('/:id/stock',
  adminAuthMiddleware,
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }
      
      await product.updateStock(req.body.stock);
      
      // Broadcast update to all connected clients
      await SyncService.broadcastProductUpdate('stock_update', product);
      
      res.json({
        success: true,
        message: 'Product stock updated successfully',
        data: { product }
      });
      
    } catch (error) {
      console.error('Error updating product stock:', error);
      res.status(500).json({
        error: 'Failed to update product stock',
        message: error.message
      });
    }
  }
);

// POST /api/products/bulk-update - Bulk update products (admin only)
router.post('/bulk-update',
  adminAuthMiddleware,
  body('updates').isArray().withMessage('Updates must be an array'),
  body('updates.*.id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  handleValidationErrors,
  async (req, res) => {
    const transaction = await Product.sequelize.transaction();
    
    try {
      const { updates } = req.body;
      const updatedProducts = [];
      
      for (const update of updates) {
        const product = await Product.findByPk(update.id, { transaction });
        
        if (product) {
          await product.update({
            ...update,
            modifiedBy: req.user.email
          }, { transaction });
          
          updatedProducts.push(product);
        }
      }
      
      await transaction.commit();
      
      // Broadcast bulk update to all connected clients
      await SyncService.broadcastBulkProductUpdate(updatedProducts);
      
      res.json({
        success: true,
        message: `${updatedProducts.length} products updated successfully`,
        data: { 
          updatedCount: updatedProducts.length,
          products: updatedProducts
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error bulk updating products:', error);
      res.status(500).json({
        error: 'Failed to bulk update products',
        message: error.message
      });
    }
  }
);

// DELETE /api/products/:id - Delete product (admin only)
router.delete('/:id',
  adminAuthMiddleware,
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await Product.findByPk(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          error: 'Product not found'
        });
      }
      
      // Clean up product image
      if (product.photo && product.photo.startsWith('/uploads/')) {
        const imagePath = path.join(__dirname, '..', 'public', product.photo);
        try {
          await fs.promises.unlink(imagePath);
        } catch (error) {
          console.warn('Failed to delete product image:', error.message);
        }
      }
      
      await product.destroy();
      
      // Broadcast deletion to all connected clients
      await SyncService.broadcastProductUpdate('delete', { id: product.id });
      
      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({
        error: 'Failed to delete product',
        message: error.message
      });
    }
  }
);

// POST /api/products/import - Import products from CSV (admin only)
router.post('/import',
  adminAuthMiddleware,
  upload.single('csvFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'CSV file is required'
        });
      }
      
      // Process CSV file (implementation depends on your CSV structure)
      const csvData = req.file.buffer.toString('utf8');
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const importedProducts = [];
      const errors = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < headers.length) continue;
        
        try {
          const productData = {
            grade: values[headers.indexOf('grade')] || 'A-GRADE',
            strain: values[headers.indexOf('strain')] || `Product ${i}`,
            thca: parseFloat(values[headers.indexOf('thca')]) || 0,
            price: parseFloat(values[headers.indexOf('price')]) || 0,
            status: values[headers.indexOf('status')] || 'AVAILABLE',
            stock: parseInt(values[headers.indexOf('stock')]) || 0,
            type: values[headers.indexOf('type')] || 'Hybrid',
            costBasis: parseFloat(values[headers.indexOf('costbasis')]) || null,
            modifiedBy: req.user.email
          };
          
          const product = await Product.create(productData);
          importedProducts.push(product);
          
        } catch (error) {
          errors.push({
            line: i + 1,
            error: error.message
          });
        }
      }
      
      // Broadcast bulk import to all connected clients
      if (importedProducts.length > 0) {
        await SyncService.broadcastBulkProductUpdate(importedProducts);
      }
      
      res.json({
        success: true,
        message: `Import completed. ${importedProducts.length} products imported.`,
        data: {
          imported: importedProducts.length,
          errors: errors.length,
          errorDetails: errors
        }
      });
      
    } catch (error) {
      console.error('Error importing products:', error);
      res.status(500).json({
        error: 'Failed to import products',
        message: error.message
      });
    }
  }
);

module.exports = router;