const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sequelize = require('./index').sequelize;

class User extends Model {
  // Instance methods
  
  /**
   * Check if provided password matches user's password
   */
  async validatePassword(password) {
    if (!password || !this.password) return false;
    return await bcrypt.compare(password, this.password);
  }
  
  /**
   * Generate password reset token
   */
  generatePasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Token expires in 24 hours
    this.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    return resetToken;
  }
  
  /**
   * Get discount rate based on tier
   */
  getDiscountRate() {
    const tierRates = {
      'Bronze': 5,
      'Silver': 10,
      'Gold': 15,
      'Platinum': 20
    };
    return tierRates[this.tier] || 0;
  }
  
  /**
   * Check if user can place orders
   */
  canPlaceOrders() {
    return this.status === 'Active' && this.emailVerified;
  }
  
  /**
   * Calculate credit available
   */
  getCreditAvailable() {
    if (this.paymentTerms === 'Immediate Payment' || this.paymentTerms === 'Prepaid Only') {
      return 0;
    }
    return Math.max(0, this.creditLimit - this.currentCredit);
  }
  
  /**
   * Update login timestamp
   */
  async updateLastLogin() {
    this.lastLogin = new Date();
    await this.save({ fields: ['lastLogin'] });
  }
  
  /**
   * Get user's tier benefits
   */
  getTierBenefits() {
    const benefits = {
      Bronze: {
        discount: 5,
        freeShippingThreshold: 2000,
        prioritySupport: false,
        accountManager: false
      },
      Silver: {
        discount: 10,
        freeShippingThreshold: 1500,
        prioritySupport: true,
        accountManager: false
      },
      Gold: {
        discount: 15,
        freeShippingThreshold: 1000,
        prioritySupport: true,
        accountManager: true
      },
      Platinum: {
        discount: 20,
        freeShippingThreshold: 500,
        prioritySupport: true,
        accountManager: true
      }
    };
    
    return benefits[this.tier] || benefits.Bronze;
  }
  
  /**
   * Check if eligible for tier upgrade
   */
  isEligibleForUpgrade() {
    const upgradeThresholds = {
      Bronze: { orders: 5, revenue: 5000 },
      Silver: { orders: 15, revenue: 15000 },
      Gold: { orders: 30, revenue: 35000 }
    };
    
    const threshold = upgradeThresholds[this.tier];
    if (!threshold) return false;
    
    return this.totalOrders >= threshold.orders && this.totalRevenue >= threshold.revenue;
  }
  
  /**
   * Convert to JSON for API responses (removes sensitive data)
   */
  toJSON() {
    const values = Object.assign({}, this.get());
    
    // Remove sensitive fields
    delete values.password;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    
    // Add computed fields
    values.discountRate = this.getDiscountRate();
    values.canPlaceOrders = this.canPlaceOrders();
    values.creditAvailable = this.getCreditAvailable();
    values.tierBenefits = this.getTierBenefits();
    values.eligibleForUpgrade = this.isEligibleForUpgrade();
    
    return values;
  }
  
  // Static methods
  
  /**
   * Find user by email
   */
  static async findByEmail(email) {
    return this.findOne({
      where: {
        email: email.toLowerCase()
      }
    });
  }
  
  /**
   * Find users by tier
   */
  static async findByTier(tier) {
    return this.findAll({
      where: { tier },
      order: [['businessName', 'ASC']]
    });
  }
  
  /**
   * Find active users
   */
  static async findActive() {
    return this.findAll({
      where: { 
        status: 'Active',
        emailVerified: true
      },
      order: [['businessName', 'ASC']]
    });
  }
  
  /**
   * Get user statistics
   */
  static async getUserStats() {
    const [total, active, pending, suspended, tiers] = await Promise.all([
      this.count(),
      this.count({ where: { status: 'Active' } }),
      this.count({ where: { status: 'Pending' } }),
      this.count({ where: { status: 'Suspended' } }),
      this.findAll({
        attributes: [
          'tier',
          [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('tier')), 'count']
        ],
        group: ['tier'],
        raw: true
      })
    ]);
    
    return {
      total,
      active,
      pending,
      suspended,
      tiers: tiers.reduce((acc, item) => {
        acc[item.tier] = parseInt(item.count);
        return acc;
      }, {})
    };
  }
  
  /**
   * Hash password
   */
  static async hashPassword(password) {
    if (!password) throw new Error('Password is required');
    return await bcrypt.hash(password, 12);
  }
}

// Initialize the model
User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Must be a valid email address'
      },
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: {
        args: [6, 255],
        msg: 'Password must be at least 6 characters long'
      }
    }
  },
  businessName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Business name is required'
      },
      len: {
        args: [1, 255],
        msg: 'Business name must be between 1 and 255 characters'
      }
    }
  },
  contactName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Contact name is required'
      },
      len: {
        args: [1, 255],
        msg: 'Contact name must be between 1 and 255 characters'
      }
    }
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      is: {
        args: /^[\+]?[1-9][\d]{0,15}$/,
        msg: 'Phone number must be valid'
      }
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Address is required'
      }
    }
  },
  businessType: {
    type: DataTypes.ENUM(
      'Licensed Dispensary',
      'Smoke Shop', 
      'CBD Store',
      'Delivery Service',
      'Distributor',
      'Other'
    ),
    allowNull: false,
    validate: {
      isIn: {
        args: [['Licensed Dispensary', 'Smoke Shop', 'CBD Store', 'Delivery Service', 'Distributor', 'Other']],
        msg: 'Invalid business type'
      }
    }
  },
  licenseNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  tier: {
    type: DataTypes.ENUM('Bronze', 'Silver', 'Gold', 'Platinum'),
    allowNull: false,
    defaultValue: 'Bronze',
    validate: {
      isIn: {
        args: [['Bronze', 'Silver', 'Gold', 'Platinum']],
        msg: 'Invalid tier'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('Active', 'Pending', 'Review', 'Suspended'),
    allowNull: false,
    defaultValue: 'Pending',
    validate: {
      isIn: {
        args: [['Active', 'Pending', 'Review', 'Suspended']],
        msg: 'Invalid status'
      }
    }
  },
  creditLimit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 5000.00,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  currentCredit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  paymentTerms: {
    type: DataTypes.ENUM(
      'Immediate Payment',
      'Net 15',
      'Net 30', 
      'Net 60',
      'Prepaid Only'
    ),
    allowNull: false,
    defaultValue: 'Immediate Payment',
    validate: {
      isIn: {
        args: [['Immediate Payment', 'Net 15', 'Net 30', 'Net 60', 'Prepaid Only']],
        msg: 'Invalid payment terms'
      }
    }
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      isInt: true
    }
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  lastOrder: {
    type: DataTypes.DATE,
    allowNull: true
  },
  joinDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Two-factor authentication
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Account preferences
  preferences: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      notifications: {
        email: true,
        orderUpdates: true,
        newProducts: true,
        priceChanges: false
      },
      dashboard: {
        defaultView: 'dashboard',
        itemsPerPage: 20
      }
    }
  },
  // Marketing and communication
  marketingOptIn: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  referralCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  referredBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Account security
  loginAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ipWhitelist: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  paranoid: true, // Soft deletes
  hooks: {
    // Hash password before creating user
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await User.hashPassword(user.password);
      }
      
      // Convert email to lowercase
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
      
      // Generate referral code
      if (!user.referralCode) {
        user.referralCode = crypto.randomBytes(6).toString('hex').toUpperCase();
      }
      
      // Generate email verification token
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    },
    
    // Hash password before updating if changed
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await User.hashPassword(user.password);
      }
      
      if (user.changed('email')) {
        user.email = user.email.toLowerCase();
        user.emailVerified = false;
        user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      }
    },
    
    // Clear sensitive fields after save
    afterSave: (user) => {
      user.password = undefined;
      user.passwordResetToken = undefined;
      user.emailVerificationToken = undefined;
      user.twoFactorSecret = undefined;
    }
  },
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['status'] },
    { fields: ['tier'] },
    { fields: ['businessType'] },
    { fields: ['joinDate'] },
    { fields: ['lastLogin'] },
    { fields: ['totalRevenue'] },
    { fields: ['totalOrders'] },
    { fields: ['passwordResetToken'] },
    { fields: ['emailVerificationToken'] },
    { fields: ['referralCode'], unique: true },
    { fields: ['status', 'emailVerified'] }
  ]
});

module.exports = User;