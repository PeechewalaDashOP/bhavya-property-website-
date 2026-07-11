// Single source of truth: property type → ordered axis keys for the chip selector.
// The frontend reads ONLY this config to build the UI — no per-page hardcoding.

export type AxisKey = 'bhk' | 'occupancy' | 'cooling';

export type AxisOption = { value: string; label: string };

export const AXIS_OPTIONS: Record<AxisKey, AxisOption[]> = {
  // BHK options are derived at runtime from the unit data (property-specific)
  bhk: [],
  occupancy: [
    { value: 'single',  label: 'Single'  },
    { value: 'double',  label: 'Double'  },
    { value: 'triple',  label: 'Triple'  },
  ],
  cooling: [
    { value: 'ac',     label: 'AC'         },
    { value: 'cooler', label: 'Cooler'     },
    { value: 'none',   label: 'No Cooling' },
  ],
};

export const AXIS_LABELS: Record<AxisKey, string> = {
  bhk:       'BHK',
  occupancy: 'Occupancy',
  cooling:   'Cooling',
};

// Maps ptype → axes shown as chip rows in the variant selector.
// Zero axes = no selector rendered; single axis = one row; two axes = two rows with
// Amazon-style mutual compatibility disabling.
export const CATEGORY_AXES: Record<string, AxisKey[]> = {
  Hostel:  ['occupancy', 'cooling'],
  PG:      ['occupancy', 'cooling'],
  Room:    [],
  Studio:  [],
  Flat:    ['bhk'],
  House:   ['bhk'],
  Villa:   ['bhk'],
  Shop:    [],
  Plot:    [],
};

// Returns the chip label for a given axis value
// (e.g. axis='bhk', value='2' → '2 BHK')
export function chipLabel(axis: AxisKey, value: string): string {
  if (axis === 'bhk') return `${value} BHK`;
  const opt = AXIS_OPTIONS[axis].find((o) => o.value === value);
  return opt?.label ?? value;
}
