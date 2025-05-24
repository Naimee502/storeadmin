import HomeLayout from "../../layouts/home";

const Settings = () => {
  return (
    <HomeLayout>
      <div className="w-full p-6 bg-amber-300">
        <p className="text-sm sm:text-base md:text-lg lg:text-xl">Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
          <div className="bg-white p-4 rounded-lg shadow">Card 1</div>
          <div className="bg-white p-4 rounded-lg shadow">Card 2</div>
          <div className="bg-white p-4 rounded-lg shadow">Card 3</div>
          </div>
        </div>
    </HomeLayout>
  );
}
export default Settings;