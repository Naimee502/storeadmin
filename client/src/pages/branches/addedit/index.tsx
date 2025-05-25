import { useParams, useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import HomeLayout from "../../../layouts/home";
import { FaStore, FaPhone, FaLock, FaMapMarkerAlt, FaEnvelope, FaCity, FaLocationArrow, FaMobileAlt } from "react-icons/fa";
import Button from "../../../components/button";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import React from "react";
import { useBranchByIDQuery, useBranchMutations } from "../../../graphql/hooks/branches";
import { useAppDispatch } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";

const AddEditBranch = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
 
  const { data } = useBranchByIDQuery(id || "");

  useEffect(() => {
  if (isEdit && data?.getBranch) {
    const branch = data.getBranch;
    setFormData({
      branchname: branch.branchname || "",
      mobile: branch.mobile || "",
      password: branch.password || "",
      logo: branch.logo || "",
      location: branch.location || "",
      address: branch.address || "",
      city: branch.city || "",
      pincode: branch.pincode || "",
      phone: branch.phone || "",
      email: branch.email || "",
      status: branch.status ?? true,
    });
  }
}, [isEdit, data]);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    branchname: "",
    mobile: "",
    password: "",
    logo: "",
    location: "",
    address: "",
    city: "",
    pincode: "",
    phone: "",
    email: "",
    status: true,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { addBranchMutation, editBranchMutation } = useBranchMutations();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setErrors((prev) => ({
      ...prev,
      [e.target.name]: "",
    }));
  };

  // Open file picker when clicking the logo area/button
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setFormData((prev) => ({
        ...prev,
        logo: "", // clear URL if user selected a new file
      }));
    } else {
      setPreviewUrl(null);
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.branchname.trim()) newErrors.branchname = "Branch name is required";
    if (!formData.mobile.trim()) newErrors.mobile = "Mobile number is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      branchname: formData.branchname,
      mobile: formData.mobile,
      password: formData.password,
      logo: selectedFile ? selectedFile.name : "",
      location: formData.location,
      address: formData.address,
      city: formData.city,
      pincode: formData.pincode,
      phone: formData.phone,
      email: formData.email,
      status: formData.status,
    };

    try {
      if (isEdit) {
        await editBranchMutation({ variables: { id, input: payload } });
        dispatch(showMessage({ message: 'Branch updated successfully!', type: 'success' }));
      } else {
        await addBranchMutation({ variables: { input: payload } });
        dispatch(showMessage({ message: 'Branch added successfully!', type: 'success' }));
      }
      navigate("/branches");
    } catch (error) {
      if (error?.message?.includes("E11000")) {
        const duplicateField = error.message.includes("mobile")
          ? "Mobile number"
          : error.message.includes("email")
          ? "Email address"
          : "Field";

        dispatch(showMessage({ message: `${duplicateField} already exists.`, type: 'error' }));
      } else {
        dispatch(showMessage({ message: 'Failed to save branch. Please try again.', type: 'error' }));
      }
    }
  };


  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Branch" : "Add Branch"}
        </h2>
        <div className="space-y-6">

          {/* Branch Detail */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Branch Detail</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField label="Branch Name" name="branchname" value={formData.branchname} onChange={handleChange} icon={<FaStore />} placeholder="Branch Name" error={errors.branchname} />
              <FormField label="Mobile Number" name="mobile" value={formData.mobile} onChange={handleChange} icon={<FaMobileAlt />} placeholder="Mobile Number" error={errors.mobile} />
              <FormField label="Password" name="password" type="password" value={formData.password} onChange={handleChange} icon={<FaLock />} placeholder="Password" error={errors.password} />

              <FormField
                label="Branch Logo"
                name="logo"
                type="file"
                placeholder="Upload Logo"
                accept="image/*"
                previewUrl={previewUrl}
                onChange={handleFileChange}
                onClick={openFilePicker}
              />

              <FormField label="Location" name="location" value={formData.location} onChange={handleChange} icon={<FaMapMarkerAlt />} placeholder="Location" />
            </div>
          </fieldset>

          {/* Address */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Address</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField label="Address" name="address" maxLength={200} value={formData.address} onChange={handleChange} icon={<FaLocationArrow />} placeholder="Address" />
              <FormField label="City" name="city" value={formData.city} onChange={handleChange} icon={<FaCity />} placeholder="City" />
              <FormField label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} icon={<FaLocationArrow />} placeholder="Pincode" />
              <FormField label="Phone Number" name="phone" type="number" value={formData.phone} onChange={handleChange} icon={<FaPhone />} placeholder="Phone Number" />
              <FormField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} icon={<FaEnvelope />} placeholder="Email" error={errors.email} />
            </div>
          </fieldset>

          {/* Status */}
          <fieldset className="border rounded-xl p-4">
            <legend className="text-sm sm:text-base font-medium px-2">Branch Status</legend>
            <FormSwitch label="" name="status" checked={formData.status} onChange={(checked) => setFormData(prev => ({ ...prev, status: checked }))} />
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/branches")}>Cancel</Button>
            <Button variant="outline" onClick={handleSubmit}>Save</Button>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default AddEditBranch;
