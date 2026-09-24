import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "tinybase/ui-react"

import { App } from "@/components/App"
import { indexes, store } from "@/lib/store"
import "@/app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store} indexes={indexes}>
      <App />
    </Provider>
  </StrictMode>,
)
