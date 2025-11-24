require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const methodOverride = require('method-override');
const cookieSession = require('cookie-session');
const { body, validationResult } = require('express-validator');

const User = require('./models/User');
const Item = require('./models/Item');

const app = express();
const PORT = process.env.PORT || 3000;
const categories = ['书籍', '电子产品', '生活用品', '运动/户外', '服饰配件', '票务/卡券'];

const categoryLabels = {
  书籍: 'Books',
  电子产品: 'Electronics',
  生活用品: 'Daily Essentials',
  '运动/户外': 'Sports / Outdoor',
  服饰配件: 'Clothing & Accessories',
  '票务/卡券': 'Tickets / Passes'
};

const supportedLangs = ['zh', 'en'];
const defaultLang = 'zh';

const translate = (lang, zhText, enText) => (lang === 'en' ? enText : zhText);
const translateByReq = (req, zhText, enText) => {
  const lang = req?.session?.lang && supportedLangs.includes(req.session.lang) ? req.session.lang : defaultLang;
  return translate(lang, zhText, enText);
};

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus-market')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use(
  cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    maxAge: 24 * 60 * 60 * 1000
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const ensureAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
};

app.use((req, res, next) => {
  const lang = supportedLangs.includes(req.session.lang) ? req.session.lang : defaultLang;
  req.session.lang = lang;

  res.locals.lang = lang;
  res.locals.tr = (zh, en) => translate(lang, zh, en);
  res.locals.categoryLabel = (value) => (lang === 'zh' ? value : categoryLabels[value] || value);
  res.locals.currentUser = req.session.user || null;
  res.locals.categories = categories;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.post('/lang/:locale', (req, res) => {
  const { locale } = req.params;
  if (supportedLangs.includes(locale)) {
    req.session.lang = locale;
  }
  res.redirect(req.get('Referer') || '/');
});

const authValidators = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage((value, { req }) => translateByReq(req, '用户名不能为空', 'Username is required'))
    .isLength({ min: 3 })
    .withMessage((value, { req }) => translateByReq(req, '用户名至少 3 个字符', 'Username must be at least 3 characters long')),
  body('password')
    .notEmpty()
    .withMessage((value, { req }) => translateByReq(req, '密码不能为空', 'Password is required'))
    .isLength({ min: 6 })
    .withMessage((value, { req }) => translateByReq(req, '密码至少 6 个字符', 'Password must be at least 6 characters long'))
];

const registerValidators = [
  ...authValidators,
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage((value, { req }) => translateByReq(req, '两次输入的密码不一致', 'Passwords do not match'))
];

const itemValidators = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage((value, { req }) => translateByReq(req, '标题不能为空', 'Title is required'))
    .isLength({ max: 80 })
    .withMessage((value, { req }) => translateByReq(req, '标题长度不能超过 80 个字符', 'Title cannot exceed 80 characters')),
  body('category')
    .trim()
    .notEmpty()
    .withMessage((value, { req }) => translateByReq(req, '请选择分类', 'Please choose a category')),
  body('price')
    .notEmpty()
    .withMessage((value, { req }) => translateByReq(req, '请输入价格', 'Please enter a price'))
    .isFloat({ min: 0 })
    .withMessage((value, { req }) => translateByReq(req, '价格必须为非负数', 'Price must be a non-negative number'))
    .toFloat(),
  body('description')
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage((value, { req }) => translateByReq(req, '描述最多 500 字', 'Description cannot exceed 500 characters'))
];

const buildItemFilters = (query) => {
  const filters = {};
  if (query.search) {
    filters.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } }
    ];
  }
  const normalizedCategory = query.category ? query.category.toLowerCase() : '';
  if (query.category && !['全部', 'all', 'all categories'].includes(normalizedCategory)) {
    filters.category = query.category;
  }
  if (query.minPrice || query.maxPrice) {
    filters.price = {};
    if (query.minPrice) {
      filters.price.$gte = Number(query.minPrice);
    }
    if (query.maxPrice) {
      filters.price.$lte = Number(query.maxPrice);
    }
  }
  return filters;
};

const mapErrors = (errors) =>
  errors.map((err) => ({
    field: err.param,
    message: err.msg
  }));

app.get(
  '/',
  asyncHandler(async (req, res) => {
    const recentItems = await Item.find().sort({ createdAt: -1 }).limit(6).populate('seller', 'username');
    res.render('index', { title: translateByReq(req, '校园二手集市', 'Campus Marketplace'), recentItems });
  })
);

app.get('/register', (req, res) => {
  res.render('auth/register', { title: translateByReq(req, '注册', 'Sign Up'), errors: [], formData: {} });
});

app.post(
  '/register',
  registerValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/register', {
        title: translateByReq(req, '注册', 'Sign Up'),
        errors: mapErrors(errors.array()),
        formData: req.body
      });
    }

    const existing = await User.findOne({ username: req.body.username });
    if (existing) {
      return res.status(409).render('auth/register', {
        title: translateByReq(req, '注册', 'Sign Up'),
        errors: [{ field: 'username', message: translateByReq(req, '用户名已被使用', 'Username is already taken') }],
        formData: req.body
      });
    }

    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
    await user.save();
    req.session.user = { id: user._id.toString(), username: user.username };
    req.session.flash = {
      type: 'success',
      message: translateByReq(req, '注册成功，欢迎加入！', 'Registration successful, welcome aboard!')
    };
    res.redirect('/items');
  })
);

app.get('/login', (req, res) => {
  res.render('auth/login', { title: translateByReq(req, '登录', 'Sign In'), errors: [], formData: {} });
});

app.post(
  '/login',
  authValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', {
        title: translateByReq(req, '登录', 'Sign In'),
        errors: mapErrors(errors.array()),
        formData: req.body
      });
    }

    const user = await User.findOne({ username: req.body.username });
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).render('auth/login', {
        title: translateByReq(req, '登录', 'Sign In'),
        errors: [{ field: 'password', message: translateByReq(req, '用户名或密码错误', 'Incorrect username or password') }],
        formData: req.body
      });
    }

    req.session.user = { id: user._id.toString(), username: user.username };
    req.session.flash = { type: 'success', message: translateByReq(req, '登录成功', 'Signed in successfully') };
    const redirectUrl = req.session.returnTo || '/items';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  })
);

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

app.get(
  '/items',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const filters = {
      search: req.query.search || '',
      category: req.query.category || '全部',
      minPrice: req.query.minPrice || '',
      maxPrice: req.query.maxPrice || ''
    };

    const items = await Item.find(buildItemFilters(req.query))
      .populate('seller', 'username')
      .sort({ createdAt: -1 });

    res.render('items/list', {
      title: translateByReq(req, '物品广场', 'Marketplace'),
      items,
      filters
    });
  })
);

app.get('/items/new', ensureAuth, (req, res) => {
  res.render('items/new', {
    title: translateByReq(req, '发布物品', 'Post Item'),
    errors: [],
    formData: {}
  });
});

app.post(
  '/items',
  ensureAuth,
  upload.single('image'),
  itemValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('items/new', {
        title: translateByReq(req, '发布物品', 'Post Item'),
        errors: mapErrors(errors.array()),
        formData: req.body
      });
    }

    const item = new Item({
      title: req.body.title,
      category: req.body.category,
      price: req.body.price,
      description: req.body.description,
      imagePath: req.file ? path.join('uploads', req.file.filename).replace(/\\\\/g, '/') : '',
      seller: req.session.user.id
    });
    await item.save();
    req.session.flash = {
      type: 'success',
      message: translateByReq(req, '物品发布成功！', 'Item published successfully!')
    };
    res.redirect('/items');
  })
);

const findItemOrRedirect = async (id, req, res) => {
  const item = await Item.findById(id).populate('seller', 'username');
  if (!item) {
    req.session.flash = {
      type: 'danger',
      message: translateByReq(req, '未找到指定物品', 'Item not found')
    };
    res.redirect('/items');
    return null;
  }
  return item;
};

app.get(
  '/items/:id',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const item = await findItemOrRedirect(req.params.id, req, res);
    if (!item) return;
    res.render('items/detail', {
      title: translateByReq(req, '物品详情', 'Item Detail'),
      item
    });
  })
);

app.get(
  '/items/:id/edit',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const item = await findItemOrRedirect(req.params.id, req, res);
    if (!item) return;

    if (item.seller._id.toString() !== req.session.user.id) {
      req.session.flash = {
        type: 'danger',
        message: translateByReq(req, '只能编辑自己发布的物品', 'You can only edit items you published')
      };
      return res.redirect('/items');
    }

    res.render('items/edit', {
      title: translateByReq(req, '编辑物品', 'Edit Item'),
      item,
      errors: [],
      formData: item
    });
  })
);

app.put(
  '/items/:id',
  ensureAuth,
  upload.single('image'),
  itemValidators,
  asyncHandler(async (req, res) => {
    const item = await findItemOrRedirect(req.params.id, req, res);
    if (!item) return;

    if (item.seller._id.toString() !== req.session.user.id) {
      req.session.flash = {
        type: 'danger',
        message: translateByReq(req, '只能编辑自己发布的物品', 'You can only edit items you published')
      };
      return res.redirect('/items');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('items/edit', {
        title: translateByReq(req, '编辑物品', 'Edit Item'),
        item,
        errors: mapErrors(errors.array()),
        formData: { ...item.toObject(), ...req.body }
      });
    }

    item.title = req.body.title;
    item.category = req.body.category;
    item.price = req.body.price;
    item.description = req.body.description;
    if (req.file) {
      item.imagePath = path.join('uploads', req.file.filename).replace(/\\\\/g, '/');
    }

    await item.save();
    req.session.flash = {
      type: 'success',
      message: translateByReq(req, '物品信息已更新', 'Item updated successfully')
    };
    res.redirect('/items');
  })
);

app.delete(
  '/items/:id',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const item = await findItemOrRedirect(req.params.id, req, res);
    if (!item) return;

    if (item.seller._id.toString() !== req.session.user.id) {
      req.session.flash = {
        type: 'danger',
        message: translateByReq(req, '只能删除自己发布的物品', 'You can only delete items you published')
      };
      return res.redirect('/items');
    }

    await item.deleteOne();
    req.session.flash = {
      type: 'success',
      message: translateByReq(req, '物品已删除', 'Item deleted successfully')
    };
    res.redirect('/items');
  })
);

const formatItem = (item) => ({
  id: item._id,
  title: item.title,
  category: item.category,
  price: item.price,
  description: item.description,
  imagePath: item.imagePath,
  seller: item.seller,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

app.get(
  '/api/items/:id',
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id).populate('seller', 'username');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(formatItem(item));
  })
);

app.post(
  '/api/items',
  ensureAuth,
  itemValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: mapErrors(errors.array()) });
    }
    const item = await Item.create({
      title: req.body.title,
      category: req.body.category,
      price: req.body.price,
      description: req.body.description,
      imagePath: req.body.imagePath || '',
      seller: req.session.user.id
    });
    res.status(201).json(formatItem(item));
  })
);

app.put(
  '/api/items/:id',
  ensureAuth,
  itemValidators,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: mapErrors(errors.array()) });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    if (item.seller.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    item.title = req.body.title;
    item.category = req.body.category;
    item.price = req.body.price;
    item.description = req.body.description;
    if (req.body.imagePath !== undefined) {
      item.imagePath = req.body.imagePath;
    }
    await item.save();
    res.json(formatItem(item));
  })
);

app.delete(
  '/api/items/:id',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    if (item.seller.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }
    await item.deleteOne();
    res.json({ message: 'Item deleted' });
  })
);

app.get(
  '/api/items/category/:category',
  asyncHandler(async (req, res) => {
    const items = await Item.find({ category: req.params.category }).sort({ createdAt: -1 }).limit(50);
    res.json(items.map(formatItem));
  })
);

app.get(
  '/api/items/hot/top10',
  asyncHandler(async (req, res) => {
    const items = await Item.find().sort({ createdAt: -1 }).limit(10);
    res.json(items.map(formatItem));
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
  res.status(500).render('error', {
    title: translateByReq(req, '系统错误', 'Server Error'),
    message: translateByReq(req, '服务器开小差了，请稍后重试。', 'Oops! Something went wrong. Please try again later.')
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

