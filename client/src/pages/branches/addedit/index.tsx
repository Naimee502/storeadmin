import { useParams, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import HomeLayout from "../../../layouts/home";
import { FaStore, FaPhone, FaLock, FaMapMarkerAlt, FaEnvelope, FaCity, FaLocationArrow, FaMobileAlt } from "react-icons/fa";
import FormPage, { FormSection, Span } from "../../../components/formpage";
import FormField from "../../../components/formfiled";
import FormSwitch from "../../../components/formswitch";
import React from "react";
import { useBranchByIDQuery, useBranchMutations } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { useImageUpload } from "../../../graphql/hooks/uploads";

const AddEditBranch = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { admin } = useAppSelector((state) => state.auth);

  const { data } = useBranchByIDQuery(id || "");

  useEffect(() => {
    if (isEdit && data?.getBranch) {
      const branch = data.getBranch;
      setFormData({
        branchname: branch.branchname || "",
        mobile: branch.mobile || "",
        password: branch.password || "",
        logo: branch.logo || "",
        imageurl: branch.imageurl || "",
        location: branch.location || "",
        address: branch.address || "",
        city: branch.city || "",
        pincode: branch.pincode || "",
        phone: branch.phone || "",
        email: branch.email || "",
        status: branch.status ?? true,
        admin: branch.admin?.id || "",
      });
    }
  }, [isEdit, data]);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const { uploadImageMutation } = useImageUpload();

  const [formData, setFormData] = useState({
    branchname: "",
    mobile: "",
    password: "",
    logo: "",
    imageurl: "",
    location: "",
    address: "",
    city: "",
    pincode: "",
    phone: "",
    email: "",
    status: true,
    admin: "",
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

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.branchname.trim()) newErrors.branchname = "Branch name is required";
    if (!formData.mobile.trim()) newErrors.mobile = "Mobile number is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.password.trim()) newErrors.password = "Password is required";
    return newErrors;
  };

  const uploadProfilePicture = async (): Promise<string | null> => {
    if (!selectedFile) {
      console.warn("No file selected.");
      return null;
    }
    try {
      const { data } = await uploadImageMutation({
        variables: { file: selectedFile },
      });

      const uniqueUrl = data?.uploadImage?.url;
      setSelectedFile(null);
      return uniqueUrl || null;
    } catch (err) {
      console.error("Upload failed", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Jump to the first field that needs attention.
      document.getElementById(Object.keys(validationErrors)[0])?.focus();
      return;
    }

    let uploadedUrl = formData.logo;

    if (selectedFile) {
      const url = await uploadProfilePicture();
      if (url) uploadedUrl = url;
    }

    const payload = {
      branchname: formData.branchname,
      mobile: formData.mobile,
      password: formData.password,
      logo: formData.logo,
      imageurl: uploadedUrl,
      location: formData.location,
      address: formData.address,
      city: formData.city,
      pincode: formData.pincode,
      phone: formData.phone,
      email: formData.email,
      status: formData.status,
      admin: admin?.id
    };

    try {
      if (isEdit) {
        await editBranchMutation({ variables: { id, input: payload } });
        dispatch(showMessage({ message: 'Branch updated successfully!', type: 'success' }));
      } else {
        await addBranchMutation({ variables: { input: payload } });
        dispatch(showMessage({ message: 'Branch added successfully!', type: 'success' }));
      }
      navigate(-1);
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


  const logoPreview = selectedFile
    ? URL.createObjectURL(selectedFile)
    : formData.imageurl || "";

  return (
    <HomeLayout>
      <FormPage
        breadcrumb="Branches"
        title={isEdit ? `Edit Branch${formData.branchname ? ` — ${formData.branchname}` : ""}` : "Add Branch"}
        onSave={handleSubmit}
        onCancel={() => navigate("/branches")}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <FormSection title="Branch details" cols={3}>
              <FormField label="Branch Name" name="branchname" required value={formData.branchname} onChange={handleChange} icon={<FaStore />} placeholder="e.g. Tragad" error={errors.branchname} />
              <FormField label="Mobile Number" name="mobile" required value={formData.mobile} onChange={handleChange} icon={<FaMobileAlt />} placeholder="10-digit mobile" error={errors.mobile} />
              <FormField label="Email" name="email" type="email" required value={formData.email} onChange={handleChange} icon={<FaEnvelope />} placeholder="branch@email.com" error={errors.email} />
              <FormField label="Password" name="password" type="password" required value={formData.password} onChange={handleChange} icon={<FaLock />} placeholder="Login password" error={errors.password} noAutofill />
              <FormField label="Location" name="location" value={formData.location} onChange={handleChange} icon={<FaMapMarkerAlt />} placeholder="Area / locality" />
              <FormField label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleChange} icon={<FaPhone />} placeholder="Landline (optional)" />
            </FormSection>

            <FormSection title="Address" cols={4}>
              <Span cols={2}>
                <FormField label="Address" name="address" value={formData.address} onChange={handleChange} icon={<FaLocationArrow />} placeholder="Shop no., building, street" />
              </Span>
              <FormField label="City" name="city" value={formData.city} onChange={handleChange} icon={<FaCity />} placeholder="City" />
              <FormField label="Pincode" name="pincode" value={formData.pincode} onChange={handleChange} icon={<FaLocationArrow />} placeholder="6 digits" />
            </FormSection>
          </div>

          {/* Side panel: logo + status */}
          <FormSection title="Logo & status" cols={2} className="h-fit lg:[&>div]:grid-cols-1">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <FaStore className="text-lg text-slate-300" />
                )}
              </div>
              <FormField
                label="Branch Logo"
                name="logo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setFormData((prev) => ({ ...prev, logo: file?.name || "" }));
                }}
              />
            </div>
            <FormSwitch
              label="Branch Status"
              name="status"
              checked={formData.status}
              onChange={(checked) => setFormData((prev) => ({ ...prev, status: checked }))}
            />
          </FormSection>
        </div>
      </FormPage>
    </HomeLayout>
  );
};

export default AddEditBranch;
