import React from "react";
import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./router";

const App = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};

export default App;
