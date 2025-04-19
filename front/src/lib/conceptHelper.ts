import fs from 'fs';
import path from 'path';

// Define path to concepts file with cross-platform compatibility
const conceptsFilePath = path.join(process.cwd(), './src/data/concepts.json');

// Ensure the directory exists
const ensureDirectoryExists = async () => {
  const dirPath = path.dirname(conceptsFilePath);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory already exists or other error
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating directory:', error);
    }
  }
};

// Call this before file operations
ensureDirectoryExists();

// Type definition to match your data structure
export type ConceptsData = string[];

/**
 * Reads concepts from the JSON file
 */
export const getConcepts = async (): Promise<ConceptsData> => {
  try {
    // For server components/API routes
    const data = await fs.promises.readFile(conceptsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading concepts file:', error);
    return [];
  }
};

/**
 * Adds a new concept to the list if it doesn't already exist
 */
export const addConcept = async (newConcept: string): Promise<boolean> => {
  try {
    const concepts = await getConcepts();
    
    // Check if concept already exists (case insensitive)
    if (concepts.some(c => c.toLowerCase() === newConcept.toLowerCase())) {
      return false; // Concept already exists
    }
    
    // Add new concept and save
    concepts.push(newConcept);
    await fs.promises.writeFile(
      conceptsFilePath,
      JSON.stringify(concepts, null, 2),
      'utf8'
    );
    
    return true;
  } catch (error) {
    console.error('Error adding concept:', error);
    throw new Error('Failed to add concept');
  }
};

/**
 * Updates the entire concepts list
 */
export const updateConcepts = async (updatedConcepts: ConceptsData): Promise<void> => {
  try {
    await fs.promises.writeFile(
      conceptsFilePath,
      JSON.stringify(updatedConcepts, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Error updating concepts:', error);
    throw new Error('Failed to update concepts');
  }
};

/**
 * Removes a concept from the list
 */
export const deleteConcept = async (conceptToDelete: string): Promise<boolean> => {
  try {
    const concepts = await getConcepts();
    const initialLength = concepts.length;
    
    const updatedConcepts = concepts.filter(
      c => c.toLowerCase() !== conceptToDelete.toLowerCase()
    );
    
    if (updatedConcepts.length === initialLength) {
      return false; // Nothing was deleted
    }
    
    await updateConcepts(updatedConcepts);
    return true;
  } catch (error) {
    console.error('Error deleting concept:', error);
    throw new Error('Failed to delete concept');
  }
};

/**
 * Validates a concept string
 */
export const validateConcept = (concept: string): boolean => {
  return concept.trim().length > 0;
};