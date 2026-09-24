import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "tinybase/ui-react"

import { Popup } from "@/components/Popup"
import { indexes, store } from "@/lib/store"
import "@/app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store} indexes={indexes}>
      <Popup />
    </Provider>
  </StrictMode>,
)
