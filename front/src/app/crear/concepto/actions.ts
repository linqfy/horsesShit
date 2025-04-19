'use server';

import { addConcept, deleteConcept, getConcepts, updateConcepts } from '@/lib/conceptHelper';

export async function loadConcepts() {
  try {
    return await getConcepts();
  } catch (error) {
    console.error('Error fetching concepts:', error);
    throw new Error('Failed to load concepts');
  }
}

export async function saveNewConcept(concept: string) {
  try {
    const success = await addConcept(concept);
    return { success };
  } catch (error) {
    console.error('Error adding concept:', error);
    throw new Error('Failed to add concept');
  }
}

export async function updateConceptsList(concepts: string[]) {
  try {
    await updateConcepts(concepts);
    return { success: true };
  } catch (error) {
    console.error('Error updating concepts:', error);
    throw new Error('Failed to update concepts');
  }
}

export async function removeConceptItem(concept: string) {
  try {
    const success = await deleteConcept(concept);
    return { success };
  } catch (error) {
    console.error('Error deleting concept:', error);
    throw new Error('Failed to delete concept');
  }
}