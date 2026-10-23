export type TemplateName =
  | 'trips' | 'trips_tahmal' | 'fuel' | 'tallies' | 'spare_parts' | 'spare_part_history'
  | 'containers' | 'drivers' | 'vehicles' | 'work_records' | 'staff' | 'payroll'
  | 'weighbridge' | 'client_deliveries' | 'tyres' | 'vehicle_compliance'
  | 'driver_compliance' | 'products' | 'rate_matrix' | 'daily_dispatch';

const HEADERS: Record<TemplateName, string[]> = {
  trips: [
    'Date', 'Truck Plate', 'Trailer No', 'Driver Name', 'Departure Point', 'Arrival Point',
    'Net Tallage', 'Fuel Expected (L)', 'Fuel Actual (L)', 'Fuel Date', 'Trips Since Refuel',
    'Fuel Cost (KES)', 'Mileage Payment (KES)', 'Labour Cost (KES)', 'Other Costs (KES)', 'Status', 'Notes',
  ],
  trips_tahmal: [
    'Date', 'Truck Plate', 'Trailer No', 'Driver Name', 'Departure Point', 'Destination',
    'Start Odometer', 'End Odometer', 'Distance KM', 'Fuel Expected (L)', 'Fuel Actual (L)',
    'Fuel Date', 'Trips Since Refuel', 'Fuel Cost (KES)', 'Mileage Payment (KES)', 'Labour Cost (KES)', 'Status', 'Notes',
  ],
  fuel: [
    'Date', 'Truck Plate', 'Trailer No', 'Driver', 'Expected Litres', 'Actual Litres',
    'Cost per Litre (KES)', 'Total Cost (KES)', 'Trips Since Last Refuel', 'Linked Trip Date', 'Notes',
  ],
  tallies: [
    'Date', 'Truck Plate', 'Trailer No', 'Driver', 'Net Tallage', 'Linked Trip Date', 'Area (MCL only)', 'Notes',
  ],
  spare_parts: [
    'Serial Number', 'Part Name', 'Category (battery/general)', 'Part Type (new/rebound)', 'Status',
    'Sub-Account', 'Supplier', 'Purchase Date', 'Unit Cost (KES)', 'Current Truck', 'Installed Date', 'Notes',
  ],
  spare_part_history: [
    'Serial Number', 'Action', 'Date', 'Truck Plate', 'Duration (days)', 'Reason', 'Performed By', 'Notes',
  ],
  containers: [
    'Container No', 'Size', 'Shipping Line', 'Agent Name', 'Consignee', 'B/L No', 'Vessel/Voyage',
    'ETA', 'Destination', 'Detention Validity', 'Release Date', 'Truck Plate', 'Trailer No', 'Status', 'Notes',
  ],
  drivers: [
    'Name', 'Phone', 'License Number', 'License Expiry', 'Status', 'Hire Date', 'Notes',
  ],
  vehicles: [
    'Plate Number', 'Make', 'Model', 'Year', 'Load Capacity (T)', 'Fuel Type',
    'Odometer (km)', 'Last Service Date', 'Status', 'Trailer Number',
  ],
  work_records: [
    'Date', 'Vehicle Plate', 'Description', 'Work Type', 'Hours Worked', 'Labour Cost (KES)',
    'Parts Cost (KES)', 'Performed By', 'Status', 'Notes',
  ],
  staff: [
    'Name', 'Designation', 'KRA PIN', 'NSSF Number', 'SHA Number', 'National ID',
    'Phone Number', 'Status', 'Notes',
  ],
  payroll: [
    'Payee Name', 'Pay Date', 'Pay Period Start', 'Pay Period End', 'Gross Salary (KES)',
    'Deductions (KES)', 'Net Salary (KES)', 'Payment Method', 'Status', 'Notes',
  ],
  weighbridge: [
    'Date', 'Ticket No', 'Lorry No', 'Goods', 'Lot/Route/Consignee', 'Qty Units', 'Weight (KG)', 'Notes',
  ],
  client_deliveries: [
    'Date', 'Client Name', 'Item Code', 'Description', 'Packaging', 'Volume/Weight',
    'Order Qty', 'Unit Price (KES)', 'Net Amount (KES)', 'Tax Amount (KES)', 'Total Amount (KES)',
    'Invoice No', 'Delivery No', 'Status',
  ],
  tyres: [
    'Tyre ID', 'Brand', 'Size', 'Serial Number', 'Type', 'Status', 'Sub-Account', 'Current Truck',
    'Position', 'Fitted Date', 'KM at Fitting', 'Removed Date', 'KM at Removal', 'KM Run',
    'Removal Reason', 'Cost (KES)', 'Supplier', 'Notes',
  ],
  vehicle_compliance: [
    'Vehicle Plate', 'Compliance Type', 'Policy/Cert No', 'Insurer/Authority', 'Issue Date',
    'Expiry Date', 'Alert Days Before', 'Renewal Cost (KES)', 'Status', 'Notes',
  ],
  driver_compliance: [
    'Driver Name', 'Compliance Type', 'Document Number', 'Issue Date', 'Expiry Date',
    'Alert Days Before', 'Status', 'Notes',
  ],
  products: [
    'Item Code', 'Description', 'Packaging', 'Volume/Weight', 'Unit Price (KES)', 'Status',
  ],
  rate_matrix: [
    'Origin', 'Destination', 'Rate Amount (KES)', 'Is Bidirectional',
  ],
  daily_dispatch: [
    'Date', 'Truck Plate', 'Driver Name', 'Route', 'Cargo Type', 'Trip Status', 'Notes',
  ],
};

export function downloadTemplate(pageName: TemplateName): void {
  const headers = HEADERS[pageName];
  if (!headers) return;
  const today = new Date().toISOString().split('T')[0];
  const csv = headers.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pageName}_template_${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
