import React, { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { FormDensityContext } from '../formpage/density';
import FormField from '../formfiled';
import Button from '../button';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { showMessage } from '../../redux/slices/message';

// Mutation Hooks
import { useCategoryMutations } from '../../graphql/hooks/categories';
import { useSubCategoryMutations } from '../../graphql/hooks/subcategories';
import { useBrandMutations } from '../../graphql/hooks/brands';
import { useProductGroupMutations } from '../../graphql/hooks/productgroups';
import { useModelMutations } from '../../graphql/hooks/models';
import { useSizeMutations } from '../../graphql/hooks/sizes';
import { useUnitMutations } from '../../graphql/hooks/units';
import { useAccountLedgerMutations } from '../../graphql/hooks/accountledgers';

export type ModalType =
  | 'category'
  | 'subcategory'
  | 'brand'
  | 'productgroup'
  | 'model'
  | 'size'
  | 'unit'
  | 'account'
  | 'custom'; // for generic children-based modal

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: ModalType;
  title?: string;
  label?: string;
  onSuccess?: (newData: any) => void;
  parentId?: string;
  categories?: any[];
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  type = 'custom',
  title,
  label,
  onSuccess,
  parentId,
  categories = [],
  children,
  size = 'md'
}) => {
  const dispatch = useAppDispatch();
  const { admin, branch, type: authType } = useAppSelector((state) => state.auth);
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminId = authType === "admin" ? admin?.id : branch?.admin?.id;

  const [formData, setFormData] = useState<any>({
    name: '',
    categoryid: parentId || '',
  });

  // Mutation Hooks
  const { addCategoryMutation } = useCategoryMutations();
  const { addSubCategoryMutation } = useSubCategoryMutations();
  const { addBrandMutation } = useBrandMutations();
  const { addProductGroupMutation } = useProductGroupMutations();
  const { addModelMutation } = useModelMutations();
  const { addSizeMutation } = useSizeMutations();
  const { addUnitMutation } = useUnitMutations();
  const { addAccountLedgerMutation } = useAccountLedgerMutations();

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset form on open
      setFormData({ name: '', categoryid: parentId || '' });
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, parentId]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      let result;
      const baseInput = { admin: adminId, status: true };

      switch (type) {
        case 'category':
          result = await addCategoryMutation({
            variables: { input: { categoryname: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addCategory);
          break;
        case 'subcategory':
          result = await addSubCategoryMutation({
            variables: { input: { subcategoryname: formData.name, category: formData.categoryid, ...baseInput } }
          });
          onSuccess?.(result.data.addSubCategory);
          break;
        case 'brand':
          result = await addBrandMutation({
            variables: { input: { brandname: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addBrand);
          break;
        case 'productgroup':
          result = await addProductGroupMutation({
            variables: { input: { productgroupname: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addProductGroup);
          break;
        case 'model':
          result = await addModelMutation({
            variables: { input: { modelname: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addModel);
          break;
        case 'size':
          result = await addSizeMutation({
            variables: { input: { sizename: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addSize);
          break;
        case 'unit':
          result = await addUnitMutation({
            variables: { input: { unitname: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addUnit);
          break;
        case 'account':
          result = await addAccountLedgerMutation({
            variables: { input: { ledgername: formData.name, ...baseInput } }
          });
          onSuccess?.(result.data.addAccountLedger);
          break;
        default:
          throw new Error('Unsupported type');
      }

      dispatch(showMessage({ message: `${label || type} added successfully`, type: 'success' }));
      onClose();
    } catch (err: any) {
      console.error(err);
      dispatch(showMessage({ message: `Failed to add ${label || type}`, type: 'error' }));
    }
  };

  const renderDynamicContent = () => {
    if (type === 'custom') return children;

    return (
      <div className="space-y-4">
        {type === 'subcategory' && !parentId && (
          <FormField
            label="Category"
            name="categoryid"
            type="select"
            options={categories.map(c => ({ value: c.id, label: c.categoryname }))}
            value={formData.categoryid}
            onChange={handleChange}
            searchable
          />
        )}
        <FormField
          label={`${label || type} Name`}
          name="name"
          placeholder={`Enter ${label?.toLowerCase() || type} name`}
          value={formData.name}
          onChange={handleChange}
          required
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={handleSubmit}>Save {label || type}</Button>
        </div>
      </div>
    );
  };

  const modalSize = type !== 'custom' ? 'sm' : size;
  const modalTitle = title || (type !== 'custom' ? `Add New ${label || type}` : '');

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-[95vw]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          {/* Above the app header (z-[1000]) so the whole window dims evenly. */}
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.12 }}
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${sizeClasses[modalSize]} flex max-h-[calc(100vh-32px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-base font-semibold capitalize text-slate-900">{modalTitle}</h3>
              <button
                onClick={onClose}
                title="Close (Esc)"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <FaTimes className="text-xs" />
              </button>
            </div>

            {/* Body */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 text-[13px]">
              <FormDensityContext.Provider value="compact">{renderDynamicContent()}</FormDensityContext.Provider>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
