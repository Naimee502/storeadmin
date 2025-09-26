import type { InputType } from "../formfiled";
import FormField from "../formfiled";

interface ServiceVariantsProps {
  formData: any; // full form state
  handleChange: (e: React.ChangeEvent<any>) => void; // handles input changes
  addServiceVariant: () => void; // add new service variant
  removeServiceVariant: (index: number) => void; // remove variant by index
  addAvailabilitySlot: (variantIndex: number) => void; // add a slot for a specific variant
  removeAvailabilitySlot: (variantIndex: number, slotIndex: number) => void; // remove a slot
  isEdit?: boolean;
  navigate: (path: string) => void;
}

export const ServiceVariants: React.FC<ServiceVariantsProps> = ({
  formData,
  handleChange,
  addServiceVariant,
  removeServiceVariant,
  addAvailabilitySlot,
  removeAvailabilitySlot,
  isEdit = false,
  navigate,
}) => (
  <>
    {formData.servicevariants.map((variant, index) => (
      <fieldset key={variant.tempid || index} className="border rounded-xl p-4 mb-4 relative">
        <legend className="text-sm font-medium px-2">Service Variant {index + 1}</legend>

        {formData.servicevariants.length > 1 && (
          <button
            type="button"
            className="absolute top-2 right-2 px-2 py-1 text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
            onClick={() => removeServiceVariant(index)}
          >
            Remove Service Variant
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-3 pt-8">
          {/* Service Code + Barcode with disable on edit */}
          {isEdit && (
            <>
              <FormField
                label="Service Code"
                placeholder="Service Code"
                name={`servicevariants.${index}.servicecode`}
                type="text"
                value={variant.servicecode}
                onChange={handleChange}
                disabled
              />
              <FormField
                label="Service Barcode"
                placeholder="Service Barcode"
                name={`servicevariants.${index}.servicebarcode`}
                type="text"
                value={variant.servicebarcode}
                onChange={handleChange}
                disabled
              />
            </>
          )}

          {/* Existing mapped fields */}
          {[
            { label: "Name", name: "name" },
            { label: "Service Rate", name: "servicerate", type: "number" },
            { label: "Unit of Measure", name: "uom" },
            { label: "Duration Amount", name: "duration.amount", type: "number" },
            { label: "Duration Unit", name: "duration.unit", type: "select", options: [{ label: "Minutes", value: "minutes" }, { label: "Hours", value: "hours" }] },
            { label: "Requires Appointment", name: "requiresappointment", type: "checkbox" },
            { label: "Location Type", name: "locationType", type: "select", options: [{ label: "Onsite", value: "onsite" }, { label: "Offsite", value: "offsite" }, { label: "Remote", value: "remote" }] },
            { label: "Is Recurring", name: "isRecurring", type: "checkbox" },
            { label: "Recurrence Interval", name: "recurrence.interval", type: "select", options: [{ label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }] },
            { label: "Recurrence Count", name: "recurrence.count", type: "number" },
            { label: "Remarks", name: "remarks" },
            { label: "Service Like Count", name: "servicelikecount", type: "number" },
          ].map(({ label, name, type, options }) => (
            <FormField
              key={name}
              label={label}
              placeholder={label}
              name={`servicevariants.${index}.${name}`}
              type={(type ?? "text") as InputType}
              options={options}
              value={name.includes(".") ? name.split(".").reduce((o, i) => o[i], variant) : variant[name]}
              onChange={handleChange}
              searchable
            />
          ))}
        </div>

        {/* Availability Slots */}
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="text-sm font-semibold">Availability Slots</h4>
          {variant.availabilityslots.map((slot, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 border p-3 rounded relative bg-gray-50">
              <button
                type="button"
                className="absolute top-2 right-2 px-2 py-1 text-xs text-red-600 border border-red-600 rounded hover:bg-red-50 bg-white"
                onClick={() => removeAvailabilitySlot(index, slotIndex)}
              >
                Remove Slot
              </button>

              {[
                { label: "Day", name: "day", type: "multiselect", options: [{ label: "Mon", value: "mon" }, { label: "Tue", value: "tue" }, { label: "Wed", value: "wed" }, { label: "Thu", value: "thu" }, { label: "Fri", value: "fri" }, { label: "Sat", value: "sat" }, { label: "Sun", value: "sun" }] },
                { label: "From", name: "from", type: "time" },
                { label: "To", name: "to", type: "time" },
              ].map(({ label, name, type, options }) => (
                <FormField
                  key={name}
                  label={label}
                  placeholder={label}
                  name={`servicevariants.${index}.availabilityslots.${slotIndex}.${name}`}
                  type={(type ?? "text") as InputType}
                  options={options}
                  value={slot[name]}
                  onChange={handleChange}
                  searchable
                />
              ))}
            </div>
          ))}
          <button
            type="button"
            className="px-3 py-1 border rounded text-sm"
            onClick={() => addAvailabilitySlot(index)}
          >
            ➕ Add Slot
          </button>
        </div>
      </fieldset>
    ))}

    <button
      type="button"
      onClick={addServiceVariant}
      className="px-4 py-2 border rounded text-sm"
    >
      ➕ Add Service Variant
    </button>
  </>
);
