import dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { Category, CategorySchema } from '../../categories/schemas/category.schema';
import { Product, ProductSchema } from '../../products/schemas/product.schema';
import { slugify } from '../../common/utils/slugify.util';

// Same precedence the app uses: the real environment, then .env.local, then
// .env — dotenv never overwrites a variable that is already set. This used to
// load .env.local with override: true, which made
// `MONGODB_URI=<new database> npm run seed:menu` quietly ignore the database
// named on the command line and replace the menu in whichever one .env.local
// pointed at.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const categories = [
  { name: 'Main Items', description: 'Fire House burgers, sandwiches, and meals.', displayOrder: 1 },
  { name: 'Sides', description: 'Sides and extras to complete your order.', displayOrder: 2 },
  { name: 'Desserts', description: 'Sweet treats to finish your meal.', displayOrder: 3 },
  { name: 'Drinks', description: 'Chilled soft drinks and refreshments.', displayOrder: 4 },
] as const;

const mealUpgradeGroup = {
  id: 'meal-upgrade',
  name: 'Meal Upgrades',
  minSelections: 0,
  maxSelections: 1,
  options: [
    {
      id: 'make-it-combo',
      name: 'Make It a Combo (+ French Fries + Soft Drink)',
      priceAdjustment: 6500,
      isAvailable: true,
    },
    {
      id: 'make-it-loaded',
      name: 'Make It Loaded (+ Loaded Fries + Soft Drink)',
      priceAdjustment: 9000,
      isAvailable: true,
    },
  ],
};

const extrasGroup = {
  id: 'extras',
  name: 'Add-ons & Sauces',
  minSelections: 0,
  maxSelections: 10,
  options: [
    { id: 'extra-beef-patty', name: 'Extra Beef Patty', priceAdjustment: 6500, isAvailable: true },
    { id: 'extra-crispy-chicken', name: 'Extra Crispy Chicken', priceAdjustment: 5500, isAvailable: true },
    { id: 'cheddar-slice', name: 'Cheddar Slice', priceAdjustment: 2000, isAvailable: true },
    { id: 'turkey-bacon', name: 'Turkey Bacon', priceAdjustment: 3000, isAvailable: true },
    { id: 'caramelized-onion', name: 'Caramelized Onion', priceAdjustment: 1500, isAvailable: true },
    { id: 'jalapenos', name: 'Jalapeños', priceAdjustment: 1000, isAvailable: true },
    { id: 'extra-coleslaw', name: 'Extra Coleslaw', priceAdjustment: 1500, isAvailable: true },
    { id: 'cheese-sauce', name: 'Cheese Sauce', priceAdjustment: 2000, isAvailable: true },
    { id: 'extra-sauce', name: 'Extra Sauce', priceAdjustment: 1500, isAvailable: true },
    { id: 'extra-bun', name: 'Extra Bun', priceAdjustment: 1500, isAvailable: true },
  ],
};

interface MenuItemSeed {
  name: string;
  description: string;
  price: number;
  category: 'Main Items' | 'Sides' | 'Desserts' | 'Drinks';
  isBestSeller?: boolean;
  images?: string[];
}

const menuItems: MenuItemSeed[] = [
  // MAIN ITEMS
  {
    name: 'Classic Beef Burger',
    description: 'Beef patty, cheddar cheese, lettuce, tomato, pickles, and house sauce.',
    price: 145,
    category: 'Main Items',
    isBestSeller: true,
    images: ['/images/restaurant/menu/classic-beef-burger.webp'],
  },
  {
    name: 'Double Smash Burger',
    description: 'Two smashed beef patties, double cheddar cheese, pickles, caramelized onions, and smash sauce.',
    price: 195,
    category: 'Main Items',
    isBestSeller: true,
    images: ['/images/restaurant/menu/double-smash-burger.webp'],
  },
  {
    name: 'BBQ Beef Burger',
    description: 'Beef patty, cheddar cheese, crispy onions, and BBQ sauce.',
    price: 165,
    category: 'Main Items',
    images: ['/images/restaurant/menu/bbq-beef-burger.webp'],
  },
  {
    name: 'Crispy Chicken Burger',
    description: 'Crispy chicken breast, lettuce, pickles, and mayo.',
    price: 135,
    category: 'Main Items',
    images: ['/images/restaurant/menu/crispy-chicken-burger.webp'],
  },
  {
    name: 'Spicy Chicken Burger',
    description: 'Spicy crispy chicken, jalapeños, coleslaw, and spicy sauce.',
    price: 145,
    category: 'Main Items',
    isBestSeller: true,
    images: ['/images/restaurant/menu/spicy-chicken-burger.webp'],
  },
  {
    name: 'Chicken Ranch Sandwich',
    description: 'Crispy chicken strips, cheddar cheese, lettuce, and ranch sauce.',
    price: 140,
    category: 'Main Items',
    images: ['/images/restaurant/menu/chicken-ranch-sandwich.webp'],
  },
  {
    name: 'Chicken Strips Meal',
    description: '4 crispy chicken strips served with fries, coleslaw, bread, and one dip.',
    price: 175,
    category: 'Main Items',
    images: ['/images/restaurant/menu/chicken-strips-meal.webp'],
  },
  {
    name: 'Fried Chicken Meal',
    description: '3 pieces of fried chicken served with fries, coleslaw, bread, and one dip.',
    price: 185,
    category: 'Main Items',
    isBestSeller: true,
    images: ['/images/restaurant/menu/fried-chicken-meal.webp'],
  },
  {
    name: 'Loaded Chicken Fries',
    description: 'French fries topped with crispy chicken, cheddar sauce, jalapeños, and house sauce.',
    price: 130,
    category: 'Main Items',
    images: ['/images/restaurant/menu/loaded-chicken-fries.webp'],
  },
  {
    name: 'Family Chicken Box',
    description: '8 pieces of fried chicken, large fries, large coleslaw, bread, and 3 dips.',
    price: 450,
    category: 'Main Items',
    images: ['/images/restaurant/menu/family-chicken-box.webp'],
  },

  // SIDES
  {
    name: 'French Fries',
    description: 'Crispy golden salted fries.',
    price: 45,
    category: 'Sides',
    images: ['/images/restaurant/menu/french-fries.webp'],
  },
  {
    name: 'Cheese Fries',
    description: 'Crispy fries drizzled with melted cheddar cheese sauce.',
    price: 65,
    category: 'Sides',
    images: ['/images/restaurant/menu/cheese-fries.webp'],
  },
  {
    name: 'Loaded Fries',
    description: 'Fries loaded with cheddar sauce, jalapeños, and house sauce.',
    price: 85,
    category: 'Sides',
    images: ['/images/restaurant/menu/loaded-fries.webp'],
  },
  {
    name: 'Onion Rings',
    description: 'Crispy golden battered onion rings.',
    price: 60,
    category: 'Sides',
    images: ['/images/restaurant/menu/onion-rings.webp'],
  },
  {
    name: 'Mozzarella Sticks',
    description: 'Crispy crumbed mozzarella sticks with dipping sauce.',
    price: 75,
    category: 'Sides',
    isBestSeller: true,
    images: ['/images/restaurant/menu/mozzarella-sticks.webp'],
  },
  {
    name: 'Chicken Strips (3 pcs)',
    description: 'Three golden crispy chicken tenders.',
    price: 90,
    category: 'Sides',
    images: ['/images/restaurant/menu/chicken-strips-3-pcs.webp'],
  },
  {
    name: 'Coleslaw',
    description: 'Fresh crisp cabbage and shredded carrots in creamy dressing.',
    price: 35,
    category: 'Sides',
    images: ['/images/restaurant/menu/coleslaw.webp'],
  },
  {
    name: 'Mac & Cheese',
    description: 'Tender pasta in creamy rich cheddar cheese sauce.',
    price: 65,
    category: 'Sides',
    images: ['/images/restaurant/menu/mac-and-cheese.webp'],
  },
  {
    name: 'Jalapeño Cheese Bites',
    description: 'Crispy bites filled with melted cheese and spicy jalapeño.',
    price: 70,
    category: 'Sides',
    images: ['/images/restaurant/menu/jalapeno-cheese-bites.webp'],
  },
  {
    name: 'Potato Wedges',
    description: 'Seasoned roasted crispy potato wedges.',
    price: 55,
    category: 'Sides',
    images: ['/images/restaurant/menu/potato-wedges.webp'],
  },

  // DESSERTS
  {
    name: 'Chocolate Brownie',
    description: 'Warm rich chocolate fudge brownie.',
    price: 65,
    category: 'Desserts',
    images: ['/images/restaurant/menu/chocolate-brownie.webp'],
  },
  {
    name: 'Lotus Cheesecake Cup',
    description: 'Creamy cheesecake layered with crunchy Lotus Biscoff.',
    price: 75,
    category: 'Desserts',
    images: ['/images/restaurant/menu/lotus-cheesecake-cup.webp'],
  },
  {
    name: 'Chocolate Cookie',
    description: 'Soft-baked double chocolate chip cookie.',
    price: 45,
    category: 'Desserts',
    images: ['/images/restaurant/menu/chocolate-cookie.webp'],
  },

  // DRINKS
  {
    name: 'Pepsi',
    description: 'Chilled Pepsi can (330ml).',
    price: 35,
    category: 'Drinks',
    images: ['/images/restaurant/menu/pepsi.webp'],
  },
  {
    name: 'Pepsi Zero',
    description: 'Chilled sugar-free Pepsi Zero can (330ml).',
    price: 35,
    category: 'Drinks',
    images: ['/images/restaurant/menu/pepsi-zero.webp'],
  },
  {
    name: '7UP',
    description: 'Refreshing lemon-lime 7UP can (330ml).',
    price: 35,
    category: 'Drinks',
    images: ['/images/restaurant/menu/7up.webp'],
  },
  {
    name: 'Mirinda',
    description: 'Crisp sparkling orange Mirinda can (330ml).',
    price: 35,
    category: 'Drinks',
    images: ['/images/restaurant/menu/mirinda.webp'],
  },
  {
    name: 'Water',
    description: 'Pure bottled mineral water.',
    price: 20,
    category: 'Drinks',
    images: ['/images/restaurant/menu/water.webp'],
  },
  {
    name: 'Large Soft Drink',
    description: 'Large cup fountain soft drink.',
    price: 45,
    category: 'Drinks',
    images: ['/images/restaurant/menu/large-soft-drink.webp'],
  },
];

const catalogDependentCollections = [
  'backinstockrequests',
  'carts',
  'reviews',
  'stockmovements',
  'wishlists',
] as const;

async function inspectCatalog() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const existingCollections = new Set(
    (await db.listCollections().toArray()).map(item => item.name)
  );
  const names = ['categories', 'products', ...catalogDependentCollections];
  const counts: Record<string, number> = {};

  for (const name of names) {
    counts[name] = existingCollections.has(name) ? await db.collection(name).countDocuments() : 0;
  }

  console.log('Current catalog counts:', counts);
}

async function applyMenuImages() {
  const ProductModel = mongoose.model(Product.name, ProductSchema);
  const itemsWithImages = menuItems.filter(
    (item): item is MenuItemSeed & { images: string[] } => Boolean(item.images?.length),
  );

  const result = await ProductModel.bulkWrite(
    itemsWithImages.map(item => ({
      updateOne: {
        filter: { name: item.name },
        update: { $set: { images: item.images } },
      },
    })),
  );

  if (result.matchedCount !== itemsWithImages.length) {
    throw new Error(
      `Expected ${itemsWithImages.length} menu items but matched ${result.matchedCount}. No catalog records were deleted.`,
    );
  }

  console.log(
    `Applied image paths to ${result.matchedCount} menu items (${result.modifiedCount} changed).`,
  );
}

async function replaceMenu() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not ready');

  const CategoryModel = mongoose.model(Category.name, CategorySchema);
  const ProductModel = mongoose.model(Product.name, ProductSchema);

  const categoryDocuments = categories.map(category => ({
    ...category,
    slug: slugify(category.name),
    parent: null,
    image: null,
    isFeaturedOnHome: category.name === 'Main Items',
    isActive: true,
  }));

  const categoryIds = new Map(
    categoryDocuments.map(category => [category.name, new Types.ObjectId()])
  );
  const productDocuments = menuItems.map((item, index) => {
    const categoryId = categoryIds.get(item.category);
    if (!categoryId) throw new Error(`Missing category for ${item.name}`);

    const isMain = item.category === 'Main Items';
    return {
      name: item.name,
      slug: slugify(item.name),
      description: item.description,
      color: null,
      styleGroup: null,
      category: categoryId,
      price: item.price * 100,
      discountPrice: null,
      images: item.images ?? [],
      sizes: [],
      variants: [],
      modifierGroups: isMain ? [mealUpgradeGroup, extrasGroup] : [],
      dietaryTags: [],
      allergens: [],
      preparationTimeMinutes: isMain ? 15 : item.category === 'Sides' ? 8 : 2,
      isAvailable: true,
      trackInventory: false,
      stockQuantity: null,
      isBestSeller: item.isBestSeller ?? false,
      isActive: true,
      displayOrder: index + 1,
      averageRating: 0,
      reviewCount: 0,
    };
  });

  for (const category of categoryDocuments) {
    const candidate = new CategoryModel({ ...category, _id: categoryIds.get(category.name) });
    const error = candidate.validateSync();
    if (error) throw error;
  }
  for (const product of productDocuments) {
    const candidate = new ProductModel(product);
    const error = candidate.validateSync();
    if (error) throw error;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const collection of catalogDependentCollections) {
        await db.collection(collection).deleteMany({}, { session });
      }
      await ProductModel.deleteMany({}, { session });
      await CategoryModel.deleteMany({}, { session });

      await CategoryModel.insertMany(
        categoryDocuments.map(category => ({ ...category, _id: categoryIds.get(category.name) })),
        { session }
      );
      await ProductModel.insertMany(productDocuments, { session });
    });
  } finally {
    await session.endSession();
  }

  const [categoryCount, itemCount, names] = await Promise.all([
    CategoryModel.countDocuments(),
    ProductModel.countDocuments(),
    ProductModel.find().sort({ displayOrder: 1 }).select('name price').lean(),
  ]);

  console.log(`Imported ${categoryCount} categories and ${itemCount} menu items.`);
  for (const item of names) {
    console.log(`- ${item.name}: ${item.price / 100} EGP`);
  }
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  await mongoose.connect(uri);
  // Named before anything is touched — --replace-menu empties the catalog, and
  // the moment to notice it's the wrong database is before that, not after.
  const { host, name } = mongoose.connection;
  console.log(`Connected to database "${name}" on ${host}`);
  try {
    await inspectCatalog();
    if (process.argv.includes('--replace-menu')) {
      await replaceMenu();
    } else if (process.argv.includes('--apply-images')) {
      await applyMenuImages();
    } else {
      console.log(
        'Inspection only. Pass --apply-images to update image paths or --replace-menu to replace catalog data.',
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(error => {
  console.error('Restaurant menu import failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
