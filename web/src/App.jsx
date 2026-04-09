import { RouterProvider } from "react-router-dom";
import { router } from "./rotas/rotas";
<<<<<<< HEAD
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
=======

function App() {
  return <RouterProvider router={router} />;
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
}

export default App;