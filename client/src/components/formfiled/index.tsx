import React, { useState } from 'react';
import {
  FaCalendarAlt,
  FaClock,
  FaLock,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaHashtag,
  FaCheckSquare,
  FaDotCircle,
  FaImage,
  FaCaretDown,
  FaPlus,
  FaHistory,
} from 'react-icons/fa';
import Select, { components, type MultiValue, type SingleValue } from 'react-select';

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'date'
  | 'datetime-local'  
  | 'time'
  | 'number'
  | 'tel'
  | 'url'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'select'
  | 'multiselect';

interface Option {
  label: string;
  value: string;
}

interface FormFieldProps {
  label: string;
  name?: string;
  type?: InputType;
  value?: any;
  onChange: (e: React.ChangeEvent<any> | { target: { name: string; value: any } }) => void;
  options?: Option[];
  error?: string;
  placeholder?: string;
  accept?: string;
  className?: string;
  previewUrl?: string | null;
  /** type="file" only — lets the picker select more than one file at once. */
  multiple?: boolean;
  multiline?: boolean;
  searchable?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  addable?: boolean;
  onAddNew?: () => void;
  required?: boolean;
  /** Optional in-dropdown history (e.g. party's last bills / product's last sale rates).
      Shows a toggle button at the bottom of the dropdown menu. */
  historyTitle?: string;
  historyHeaders?: string[];
  historyRows?: string[][];
  historyEmptyText?: string;
}

const defaultIcons: Partial<Record<InputType, React.ReactNode>> = {
  text: <FaHashtag />,
  email: <FaEnvelope />,
  password: <FaLock />,
  date: <FaCalendarAlt />,
  time: <FaClock />,
  number: <FaHashtag />,
  tel: <FaPhone />,
  url: <FaMapMarkerAlt />,
  checkbox: <FaCheckSquare />,
  radio: <FaDotCircle />,
  file: <FaImage />,
  select: <FaCaretDown />,
  multiselect: <FaCaretDown />,
};

// Shared mini history table (used inside dropdown menu + standalone panel)
const HistoryTable = ({ headers, rows, emptyText }: { headers?: string[]; rows?: string[][]; emptyText?: string }) => (
  rows && rows.length > 0 ? (
    <table className="min-w-full text-xs">
      <thead className="bg-indigo-50 text-gray-600 sticky top-0">
        <tr>
          {(headers || []).map((h, i) => (
            <th key={i} className={`px-2.5 py-1.5 font-semibold whitespace-nowrap ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-t border-gray-100">
            {row.map((cell, ci) => (
              <td key={ci} className={`px-2.5 py-1.5 whitespace-nowrap ${ci === 0 ? 'text-left font-medium' : 'text-right'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div className="px-3 py-2.5 text-xs text-gray-400">{emptyText || 'No history found.'}</div>
  )
);

// History icon shown in the select control (next to clear ✕ and dropdown arrow)
const IndicatorsWithHistory = (props: any) => {
  const { historyTitle, onHistoryToggle, menuIsOpen } = props.selectProps as {
    historyTitle?: string;
    onHistoryToggle?: () => void;
    menuIsOpen?: boolean;
  };
  return (
    <components.IndicatorsContainer {...props}>
      {historyTitle && onHistoryToggle && !menuIsOpen && (
        <div
          title={historyTitle}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onHistoryToggle(); }}
          className="px-2 flex items-center cursor-pointer text-indigo-400 hover:text-indigo-600"
        >
          <FaHistory size={14} />
        </div>
      )}
      {props.children}
    </components.IndicatorsContainer>
  );
};

// Custom Dropdown Footer
const DropdownFooter = (props: any) => {
  const { addable, onAddNew } = props.selectProps as {
    addable?: boolean;
    onAddNew?: () => void;
  };

  return (
    <>
      <components.MenuList {...props}>{props.children}</components.MenuList>
      {addable && onAddNew && (
        <div
          onClick={() => {
            // Close the dropdown before opening the Add-New modal
            (document.activeElement as HTMLElement)?.blur();
            onAddNew();
          }}
          className="px-3 py-2 flex items-center gap-2 text-blue-600 cursor-pointer hover:bg-blue-50 border-t"
        >
          <FaPlus size={12} /> <span className="text-sm font-medium">Add New</span>
        </div>
      )}
    </>
  );
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text' as InputType,
  value,
  onChange,
  options = [],
  error,
  placeholder,
  accept,
  className = '',
  previewUrl = null,
  multiple = false,
  multiline = false,
  searchable = false,
  icon,
  disabled,
  addable = false,
  onAddNew,
  required,
  historyTitle,
  historyHeaders,
  historyRows,
  historyEmptyText,
}) => {
  // Standalone history panel (opened via the clock icon in the select control)
  const [historyOpen, setHistoryOpen] = useState(false);
  React.useEffect(() => { setHistoryOpen(false); }, [value]);

  const isCheckbox = type === 'checkbox';
  const isRadio = type === 'radio';
  const isFile = type === 'file';
  const isSelect = type === 'select' && options.length > 0;
  const isMultiSelect = type === 'multiselect' && options.length > 0;
  const finalIcon = icon ?? defaultIcons[type];

  const renderInput = () => {
    if (multiline) {
      return (
        <textarea
          id={name}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`w-full p-2 text-sm outline-none bg-transparent ${className}`}
        />
      );
    }

    if ((isSelect || isMultiSelect) && searchable) {
      const SelectWithCustom = Select as any;
      return (
        <div className="relative">
        <SelectWithCustom
          inputId={name}
          name={name}
          options={options}
          isDisabled={disabled}
          value={
            isMultiSelect
              ? options.filter((opt) => value?.includes(opt.value))
              : options.find((opt) => opt.value === value) || null
          }
          onChange={(selected: MultiValue<Option> | SingleValue<Option>) => {
          if (isMultiSelect) {
            const selectedArray = selected as MultiValue<Option>; 
            onChange({
              target: {
                name,
                value: selectedArray ? selectedArray.map((opt) => opt.value) : [],
              },
            });
          } else {
            const selectedOption = selected as SingleValue<Option>;
            onChange({
              target: {
                name,
                value: selectedOption?.value || "",
              },
            });
          }
        }}
          isClearable
          isSearchable
          isMulti={isMultiSelect}
          placeholder={placeholder || `Select ${label}`}
          components={{ MenuList: DropdownFooter, IndicatorsContainer: IndicatorsWithHistory }}
          addable={addable}
          onAddNew={onAddNew}
          historyTitle={historyTitle}
          historyHeaders={historyHeaders}
          historyRows={historyRows}
          historyEmptyText={historyEmptyText}
          onHistoryToggle={() => setHistoryOpen((s) => !s)}
          onMenuOpen={() => setHistoryOpen(false)}
          menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
          menuPosition="fixed"
          menuShouldScrollIntoView={false}
          styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
        />
        {historyOpen && historyTitle && (
          <div className="absolute left-0 right-0 top-full mt-1 z-[9998] bg-white border border-indigo-200 rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
              <span className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                <FaHistory size={12} /> {historyTitle}
              </span>
              <span
                onClick={() => setHistoryOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-sm leading-none px-1"
              >
                ✕
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <HistoryTable headers={historyHeaders} rows={historyRows} emptyText={historyEmptyText} />
            </div>
          </div>
        )}
        </div>
      );
    }

    if ((isSelect || isMultiSelect) && !searchable) {
      return (
        <select
          id={name}
          name={name}
          multiple={isMultiSelect}
          value={value}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
            onChange({
              target: { name, value: isMultiSelect ? selected : e.target.value },
            });
          }}
          disabled={disabled}
          required={required}
          className={`w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none ${className}`}
        >
          {!isMultiSelect && <option value="">Select {label}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (isRadio) {
      return (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={onChange}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }

    if (isCheckbox) {
      return (
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={Boolean(value)}
          onChange={(e) =>
            onChange({
              target: { name, value: e.target.checked },
            })
          }
          className="h-5 w-5"
        />
      );
    }

    if (isFile) {
      // Just the file input — the thumbnail preview is shown separately
      // (e.g. DataTable's dedicated "Preview" column) so this field stays
      // compact instead of spilling a raw blob/UUID filename into the row.
      return (
        <input
          type="file"
          id={name}
          name={name}
          accept={accept}
          multiple={multiple}
          onChange={onChange}
          disabled={disabled}
          className="w-full text-sm"
        />
      );
    }

    // A native date input always renders in the BROWSER's locale — on a US
    // Chrome that is MM/DD/YYYY, and no attribute changes it (lang="en-GB" was
    // tried and ignored). So keep the real <input type="date"> — the calendar,
    // keyboard entry and the YYYY-MM-DD value all stay exactly as they were —
    // but paint its text transparent and lay a DD/MM/YYYY label over it.
    if (type === 'date') {
      const raw = value ?? '';
      // Callers normally hold YYYY-MM-DD (what the input itself uses), but a few
      // pass a Date or an epoch — fall back rather than blanking the field.
      let ymd = String(raw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) && raw !== '') {
        const d = new Date(/^\d+$/.test(ymd) ? Number(ymd) : ymd);
        ymd = isNaN(d.getTime())
          ? ''
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
              d.getDate()
            ).padStart(2, '0')}`;
      }
      const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const shown = m ? `${m[3]}/${m[2]}/${m[1]}` : '';
      return (
        <span className="relative flex-1 flex items-center">
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm ${
              shown ? 'text-gray-900' : 'text-gray-400'
            }`}
          >
            {shown || 'DD/MM/YYYY'}
          </span>
          <input
            id={name}
            name={name}
            type="date"
            value={ymd}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={`w-full text-sm bg-transparent outline-none text-transparent ${className}`}
          />
        </span>
      );
    }

    return (
      <input
        id={name}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder ?? (type === 'number' ? '0' : placeholder)}
        accept={accept}
        className={`w-full text-sm bg-transparent outline-none ${className}`}
      />
    );
  };

  return (
    <div className="flex flex-col w-full gap-1">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
        {label}
      </label>

      {(isSelect || isMultiSelect|| isCheckbox || isRadio) ? (
        renderInput()
      ) : (
        <div
          className={`flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          {finalIcon && (
            <span className="text-gray-400">{finalIcon}</span>
          )}
          {renderInput()}
        </div>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
};

export default FormField;
