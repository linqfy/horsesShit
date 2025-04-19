import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF; // You can refine 'any' with the actual options type if available
    lastAutoTable?: {
      finalY: number;
      // Add other properties if needed
    };
  }
}