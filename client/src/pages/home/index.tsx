import HomeLayout from "../../layouts/home";
import { useAppSelector } from "../../redux/hooks";

const Home = () => {
    const authUserName = useAppSelector((state) => state.auth.name);
    return (
        <HomeLayout>
          <div className="w-full h-full p-6">
            <h1 className="text-2xl font-semibold text-gray-800">Hello, {authUserName} welcome to home ! </h1>
            <p className="text-gray-700 mt-2">Manage your preferences and configurations here.</p>
          </div>
        </HomeLayout>
    );
}
export default Home;