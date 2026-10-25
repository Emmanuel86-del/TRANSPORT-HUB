// src/lib/excelTemplates.ts
import * as XLSX from 'xlsx';

export const TEMPLATE_SCHEMAS: Record<string, { filename: string; headers: string[]; example: Record<string, any> }> = {
  spare_parts: {
    filename: 'Spare_Parts_Import_Template.xlsx',
    headers: ['part_number', 'name', 'category', 'vehicle_plate', 'serial_number', 'unit_cost', 'quantity', 'supplier'],
    example: {
      part_number: 'PRT-1001',
      name: 'Brake Lining',
      category: 'General Spares',
      vehicle_plate: 'KDP 417R',
      serial_number: 'SN-99812',
      unit_cost: 4500,
      quantity: 4,
      supplier: 'Mombasa Auto Spares'
    }
  },
  trips: {
    filename: 'Trips_Import_Template.xlsx',
    headers: ['trip_date', 'vehicle_plate', 'driver_name', 'origin', 'destination', 'cargo_type', 'distance_km', 'tonnage'],
    example: {
      trip_date: '2026-10-25',
      vehicle_plate: 'KDP 417R',
      driver_name: 'John Doe',
      origin: 'Vipingo',
      destination: 'Mombasa Plant',
      cargo_type: 'Limestone',
      distance_km: 45,
      tonnage: 38.5
    }
  },
  tyres: {
    filename: 'Tyre_Inventory_Import_Template.xlsx',
    headers: ['serial_number', 'brand', 'size', 'vehicle_plate', 'position', 'status', 'cost'],
    example: {
      serial_number: 'TYR-88392',
      brand: 'Bridgestone',
      size: '315/80R22.5',
      vehicle_plate: 'KDX 926L',
      position: 'Front Left',
      status: 'Active',
      cost: 32000
    }
  }
};

export function downloadExcelTemplate(type: keyof typeof TEMPLATE_SCHEMAS) {
  const schema = TEMPLATE_SCHEMAS[type];
  if (!schema) return;

  const worksheet = XLSX.utils.json_to_sheet([schema.example]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, schema.filename);
}
