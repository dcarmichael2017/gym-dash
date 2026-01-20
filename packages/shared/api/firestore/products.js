import { doc, addDoc, collection, updateDoc, getDocs, deleteDoc, getDoc, query, where } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

// --- PRODUCT CATEGORIES (Predefined) ---
export const PRODUCT_CATEGORIES = [
  { id: 'gear', name: 'Gear', description: 'Equipment, rashguards, gis' },
  { id: 'apparel', name: 'Apparel', description: 'T-shirts, hoodies, shorts' },
  { id: 'drinks', name: 'Drinks', description: 'Water, protein shakes' },
  { id: 'supplements', name: 'Supplements', description: 'Protein, vitamins' },
  { id: 'accessories', name: 'Accessories', description: 'Bags, gloves, wraps' }
];

// --- CRUD FUNCTIONS ---

/**
 * Create a new product
 * @param {string} gymId - Gym ID
 * @param {object} productData - Product data
 * @returns {Promise<{success: boolean, product?: object, error?: string}>}
 */
export const createProduct = async (gymId, productData) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "products");

    const payload = {
      name: productData.name,
      description: productData.description || '',
      category: productData.category || 'gear',

      // Pricing
      price: parseFloat(productData.price) || 0,
      compareAtPrice: productData.compareAtPrice ? parseFloat(productData.compareAtPrice) : null,

      // Variants
      hasVariants: productData.hasVariants || false,
      variants: productData.variants || [],

      // Stock (used when no variants)
      stock: productData.hasVariants ? null : (parseInt(productData.stock) || 0),
      lowStockThreshold: parseInt(productData.lowStockThreshold) || 5,

      // Images
      images: productData.images || [],

      // Status
      active: productData.active !== false,
      visibility: productData.visibility || 'public',
      featured: productData.featured || false,

      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: auth.currentUser?.uid || 'system'
    };

    const docRef = await addDoc(collectionRef, payload);
    return { success: true, product: { id: docRef.id, ...payload } };
  } catch (error) {
    console.error("[createProduct] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all products for a gym
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, products?: array, error?: string}>}
 */
export const getProducts = async (gymId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "products");
    const snapshot = await getDocs(collectionRef);
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, products };
  } catch (error) {
    console.error("[getProducts] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get active products for a gym (for member store)
 * @param {string} gymId - Gym ID
 * @returns {Promise<{success: boolean, products?: array, error?: string}>}
 */
export const getActiveProducts = async (gymId) => {
  try {
    const collectionRef = collection(db, "gyms", gymId, "products");
    const q = query(collectionRef, where("active", "==", true));
    const snapshot = await getDocs(q);
    const products = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => p.visibility === 'public');
    return { success: true, products };
  } catch (error) {
    console.error("[getActiveProducts] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a single product by ID
 * @param {string} gymId - Gym ID
 * @param {string} productId - Product ID
 * @returns {Promise<{success: boolean, product?: object, error?: string}>}
 */
export const getProductById = async (gymId, productId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "products", productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Product not found" };
    }

    return { success: true, product: { id: docSnap.id, ...docSnap.data() } };
  } catch (error) {
    console.error("[getProductById] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Update a product
 * @param {string} gymId - Gym ID
 * @param {string} productId - Product ID
 * @param {object} data - Updated fields
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateProduct = async (gymId, productId, data) => {
  try {
    const docRef = doc(db, "gyms", gymId, "products", productId);

    // Clean up data - remove undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    // Parse numeric fields if present
    if (cleanData.price !== undefined) {
      cleanData.price = parseFloat(cleanData.price) || 0;
    }
    if (cleanData.compareAtPrice !== undefined) {
      cleanData.compareAtPrice = cleanData.compareAtPrice ? parseFloat(cleanData.compareAtPrice) : null;
    }
    if (cleanData.stock !== undefined && cleanData.hasVariants !== true) {
      cleanData.stock = parseInt(cleanData.stock) || 0;
    }
    if (cleanData.lowStockThreshold !== undefined) {
      cleanData.lowStockThreshold = parseInt(cleanData.lowStockThreshold) || 5;
    }

    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error("[updateProduct] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a product
 * @param {string} gymId - Gym ID
 * @param {string} productId - Product ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteProduct = async (gymId, productId) => {
  try {
    const docRef = doc(db, "gyms", gymId, "products", productId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error("[deleteProduct] Error:", error);
    return { success: false, error: error.message };
  }
};

// --- INVENTORY FUNCTIONS ---

/**
 * Update stock for a product or variant
 * @param {string} gymId - Gym ID
 * @param {string} productId - Product ID
 * @param {string|null} variantId - Variant ID (null for non-variant products)
 * @param {number} quantity - New stock quantity
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateProductStock = async (gymId, productId, variantId, quantity) => {
  try {
    const docRef = doc(db, "gyms", gymId, "products", productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: "Product not found" };
    }

    const product = docSnap.data();
    const newQuantity = parseInt(quantity) || 0;

    if (variantId && product.hasVariants) {
      // Update variant stock
      const variants = product.variants || [];
      const variantIndex = variants.findIndex(v => v.id === variantId);

      if (variantIndex === -1) {
        return { success: false, error: "Variant not found" };
      }

      variants[variantIndex].stock = newQuantity;

      await updateDoc(docRef, {
        variants,
        updatedAt: new Date()
      });
    } else {
      // Update product stock
      await updateDoc(docRef, {
        stock: newQuantity,
        updatedAt: new Date()
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[updateProductStock] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get products with low stock
 * @param {string} gymId - Gym ID
 * @param {number} threshold - Optional override threshold (default uses product's own threshold)
 * @returns {Promise<{success: boolean, products?: array, error?: string}>}
 */
export const getLowStockProducts = async (gymId, threshold = null) => {
  try {
    const result = await getProducts(gymId);

    if (!result.success) {
      return result;
    }

    const lowStockProducts = result.products.filter(product => {
      if (!product.active) return false;

      const productThreshold = threshold || product.lowStockThreshold || 5;

      if (product.hasVariants) {
        // Check if any variant is below threshold
        return (product.variants || []).some(v => (v.stock || 0) <= productThreshold);
      } else {
        return (product.stock || 0) <= productThreshold;
      }
    });

    return { success: true, products: lowStockProducts };
  } catch (error) {
    console.error("[getLowStockProducts] Error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get total stock count for a product (across all variants if applicable)
 * @param {object} product - Product object
 * @returns {number} Total stock
 */
export const getTotalStock = (product) => {
  if (product.hasVariants) {
    return (product.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
  }
  return product.stock || 0;
};

/**
 * Check if a product is in stock
 * @param {object} product - Product object
 * @param {string|null} variantId - Optional variant ID
 * @returns {boolean}
 */
export const isInStock = (product, variantId = null) => {
  if (product.hasVariants && variantId) {
    const variant = (product.variants || []).find(v => v.id === variantId);
    return variant ? (variant.stock || 0) > 0 : false;
  }

  if (product.hasVariants) {
    return (product.variants || []).some(v => (v.stock || 0) > 0);
  }

  return (product.stock || 0) > 0;
};
