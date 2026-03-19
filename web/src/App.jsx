import { RouterProvider } from "react-router-dom";
import { router } from "./rotas/rotas";

function App() {
  return <RouterProvider router={router} />;
}

export default App;