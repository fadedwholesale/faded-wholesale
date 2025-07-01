const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index').sequelize;

class Product extends Model {
  // Instance methods
  
  /**
   * Calculate profit margin based on cost basis
   */
  getMargin() {
    if (!this.costBasis || this.costBasis <= 0) return null;
    return Math.round(((this.price - this.costBasis) / this.costBasis) * 100);
  }
  
  /**
   * Get unit label based on product grade
   */
  getUnitLabel() {
    switch(this.grade) {
      case 'ROSIN': return '/gram';
      case 'VAPE': return '/unit';
      default: return '/lb';
    }
  }
  
  /**
   * Check if product is available for ordering
   */
  isAvailable() {
    return this.status === 'AVAILABLE' && this.stock > 0;
  }
  
  /**
   * Get display name with grade and strain
   */
  getDisplayName() {
    return `${this.grade} - ${this.strain}`;
  }
  
  /**
   * Update stock and auto-manage status
   */
  async updateStock(newStock, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    this.stock = Math.max(0, newStock);
    
    // Auto-update status based on stock
    if (this.stock === 0 && this.status === 'AVAILABLE') {
      this.status = 'SOLD OUT';
    } else if (this.stock > 0 && this.status === 'SOLD OUT') {
      this.status = 'AVAILABLE';
    }
    
    this.lastModified = new Date();
    
    await this.save(options);
    return this;
  }
  
  /**
   * Get product image URL or placeholder
   */
  getImageUrl() {
    if (this.photo && this.photo.trim()) {
      return this.photo;
    }
    // Return placeholder based on grade
    const gradeEncoded = encodeURIComponent(this.grade);
    return `https://via.placeholder.com/200x200/1a1a1a/00C851?text=${gradeEncoded}`;
  }
  
  /**
   * Convert to JSON for API responses (removes sensitive data)
   */
  toJSON() {
    const values = Object.assign({}, this.get());
    
    // Add computed fields
    values.margin = this.getMargin();
    values.unitLabel = this.getUnitLabel();
    values.displayName = this.getDisplayName();
    values.available = this.isAvailable();
    values.imageUrl = this.getImageUrl();
    
    // Remove internal fields for public API
    if (this.hideInternal) {
      delete values.costBasis;
      delete values.modifiedBy;
    }
    
    return values;
  }
  
  // Static methods
  
  /**
   * Find available products with stock
   */
  static async findAvailable(options = {}) {
    return this.findAll({
      where: {
        status: 'AVAILABLE',
        stock: {
          [sequelize.Sequelize.Op.gt]: 0
        }
      },
      order: [['strain', 'ASC']],
      ...options
    });
  }
  
  /**
   * Find products by grade
   */
  static async findByGrade(grade, options = {}) {
    return this.findAll({
      where: { grade },
      order: [['strain', 'ASC']],
      ...options
    });
  }
  
  /**
   * Search products by strain name
   */
  static async searchByStrain(searchTerm, options = {}) {
    return this.findAll({
      where: {
        strain: {
          [sequelize.Sequelize.Op.like]: `%${searchTerm}%`
        }
      },
      order: [['strain', 'ASC']],
      ...options
    });
  }
  
  /**
   * Get low stock products
   */
  static async findLowStock(threshold = 10, options = {}) {
    return this.findAll({
      where: {
        stock: {
          [sequelize.Sequelize.Op.lte]: threshold,
          [sequelize.Sequelize.Op.gt]: 0
        },
        status: 'AVAILABLE'
      },
      order: [['stock', 'ASC']],
      ...options
    });
  }
  
  /**
   * Get products by status
   */
  static async findByStatus(status, options = {}) {
    return this.findAll({
      where: { status },
      order: [['strain', 'ASC']],
      ...options
    });
  }
  
  /**
   * Calculate total inventory value
   */
  static async getTotalInventoryValue() {
    const result = await this.findAll({
      attributes: [
        [sequelize.Sequelize.fn('SUM', 
          sequelize.Sequelize.literal('price * stock')
        ), 'totalValue']
      ],
      where: {
        status: 'AVAILABLE'
      },
      raw: true
    });
    
    return parseFloat(result[0]?.totalValue || 0);
  }
  
  /**
   * Get inventory statistics
   */
  static async getInventoryStats() {
    const [totalProducts, availableProducts, totalValue, lowStockCount] = await Promise.all([
      this.count(),
      this.count({ where: { status: 'AVAILABLE', stock: { [sequelize.Sequelize.Op.gt]: 0 } } }),
      this.getTotalInventoryValue(),
      this.count({ 
        where: { 
          stock: { [sequelize.Sequelize.Op.lte]: 10, [sequelize.Sequelize.Op.gt]: 0 },
          status: 'AVAILABLE'
        } 
      })
    ]);
    
    return {
      totalProducts,
      availableProducts,
      totalValue,
      lowStockCount,
      outOfStockCount: totalProducts - availableProducts
    };
  }
}

// Initialize the model
Product.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  grade: {
    type: DataTypes.ENUM('A-GRADE', 'B-GRADE', 'ROSIN', 'VAPE', 'BULK'),
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: [['A-GRADE', 'B-GRADE', 'ROSIN', 'VAPE', 'BULK']]
    }
  },
  strain: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  thca: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  costBasis: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'COMING SOON', 'SOLD OUT'),
    allowNull: false,
    defaultValue: 'AVAILABLE',
    validate: {
      isIn: [['AVAILABLE', 'COMING SOON', 'SOLD OUT']]
    }
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      isInt: true
    }
  },
  type: {
    type: DataTypes.ENUM('Indica', 'Sativa', 'Hybrid', 'Concentrate'),
    allowNull: false,
    defaultValue: 'Hybrid',
    validate: {
      isIn: [['Indica', 'Sativa', 'Hybrid', 'Concentrate']]
    }
  },
  photo: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      isUrl: {
        msg: 'Photo must be a valid URL'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lastModified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  modifiedBy: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Modified by must be a valid email address'
      }
    }
  },
  // SEO and metadata fields
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  metaTitle: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  metaDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Inventory tracking
  minimumStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: 0
    }
  },
  // Product categorization
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  // Featured/promoted products
  featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Lab results and compliance
  labResults: {
    type: DataTypes.JSON,
    allowNull: true
  },
  coa: {
    type: DataTypes.TEXT, // Certificate of Analysis URL
    allowNull: true
  },
  // Pricing history for analytics
  priceHistory: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  sequelize,
  modelName: 'Product',
  tableName: 'products',
  timestamps: true,
  paranoid: true, // Soft deletes
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
  hooks: {
    // Auto-generate slug before creation
    beforeCreate: async (product) => {
      if (!product.slug && product.strain) {
        product.slug = product.strain
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        
        // Ensure slug uniqueness
        const existingProduct = await Product.findOne({ where: { slug: product.slug } });
        if (existingProduct) {
          product.slug = `${product.slug}-${Date.now()}`;
        }
      }
      
      // Track price changes
      if (product.price && product.costBasis) {
        product.priceHistory = [{
          price: product.price,
          costBasis: product.costBasis,
          timestamp: new Date(),
          modifiedBy: product.modifiedBy
        }];
      }
    },
    
    // Update lastModified timestamp on updates
    beforeUpdate: (product) => {
      product.lastModified = new Date();
      
      // Track price changes
      if (product.changed('price') || product.changed('costBasis')) {
        const priceHistory = product.priceHistory || [];
        priceHistory.push({
          price: product.price,
          costBasis: product.costBasis,
          timestamp: new Date(),
          modifiedBy: product.modifiedBy
        });
        
        // Keep only last 50 price changes
        if (priceHistory.length > 50) {
          priceHistory.splice(0, priceHistory.length - 50);
        }
        
        product.priceHistory = priceHistory;
      }
    }
  },
  indexes: [
    { fields: ['grade'] },
    { fields: ['status'] },
    { fields: ['stock'] },
    { fields: ['strain'] },
    { fields: ['featured'] },
    { fields: ['lastModified'] },
    { fields: ['createdAt'] },
    { fields: ['slug'], unique: true },
    { fields: ['grade', 'status'] },
    { fields: ['status', 'stock'] }
  ]
});

module.exports = Product;