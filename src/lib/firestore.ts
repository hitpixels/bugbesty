import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

// Helper function to convert Firestore document to a plain object with ID
const convertDocToObject = <T>(doc: QueryDocumentSnapshot<DocumentData>): T & { id: string } => {
  return {
    id: doc.id, 
    ...doc.data()
  } as T & { id: string };
};

// Get a single document by ID
export async function getDocument<T>(collectionName: string, id: string): Promise<T & { id: string } | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as T & { id: string };
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

// Get multiple documents from a collection
export async function getDocuments<T>(
  collectionName: string, 
  options?: {
    fieldPath?: string;
    operator?: any;
    value?: any;
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    limitCount?: number;
  }
): Promise<(T & { id: string })[]> {
  try {
    let q = collection(db, collectionName);
    let queryConstraints = [];
    
    if (options?.fieldPath && options?.operator && options.value !== undefined) {
      queryConstraints.push(where(options.fieldPath, options.operator, options.value));
    }
    
    if (options?.orderByField) {
      const direction = options.orderDirection || 'asc';
      queryConstraints.push(orderBy(options.orderByField, direction));
    }
    
    if (options?.limitCount) {
      queryConstraints.push(limit(options.limitCount));
    }
    
    try {
      const queryRef = query(q, ...queryConstraints);
      const querySnapshot = await getDocs(queryRef);
      return querySnapshot.docs.map(doc => convertDocToObject<T>(doc));
    } catch (error: any) {
      // Handle index errors (failed-precondition often means missing index)
      if (error.code === 'failed-precondition' && options?.orderByField) {
        console.warn(`Index error in ${collectionName}:`, error.message);
        console.log('Falling back to simpler query without ordering');
        
        // Retry without ordering
        const fallbackConstraints = queryConstraints.filter(
          constraint => !String(constraint).includes('orderBy')
        );
        const fallbackRef = query(q, ...fallbackConstraints);
        const fallbackSnapshot = await getDocs(fallbackRef);
        
        // Get results and sort them client-side instead
        const results = fallbackSnapshot.docs.map(doc => convertDocToObject<T>(doc));
        if (options.orderByField) {
          return results.sort((a: any, b: any) => {
            const aVal = a[options.orderByField!];
            const bVal = b[options.orderByField!];
            const direction = options.orderDirection === 'desc' ? -1 : 1;
            
            // Handle different types of values
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return direction * aVal.localeCompare(bVal);
            } else {
              return direction * ((aVal > bVal) ? 1 : ((aVal < bVal) ? -1 : 0));
            }
          });
        }
        return results;
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    // Return empty array instead of throwing to avoid crashing the app
    return [];
  }
}

// Create document with auto-generated ID
export async function createDocument<T>(collectionName: string, data: T): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, collectionName), data as DocumentData);
    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

// Create document with specific ID
export async function createDocumentWithId<T>(collectionName: string, id: string, data: T): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, data as DocumentData);
  } catch (error) {
    console.error(`Error creating document with ID in ${collectionName}:`, error);
    throw error;
  }
}

// Update document
export async function updateDocument<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data as DocumentData);
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

// Delete document
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
} 