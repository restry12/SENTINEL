import { AuthGuard } from "@/components/auth-guard"
import { ChatPage } from "@/components/chat/chat-page"

export default function Chat() {
  return (
    <AuthGuard>
      <ChatPage />
    </AuthGuard>
  )
}
