import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f7f7f5] font-sans">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-white border border-gray-200/80 shadow-xl rounded-2xl",
            formButtonPrimary:
              "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-sm transition-all",
            headerTitle: "text-gray-900 font-bold",
            headerSubtitle: "text-gray-400 font-medium",
            socialButtonsBlockButton:
              "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors",
            formFieldLabel: "text-gray-600 font-medium",
            formFieldInput: "bg-gray-50 border-gray-200 text-gray-900 focus:border-violet-500 focus:bg-white transition-all",
            footerActionLink: "text-violet-600 hover:text-violet-500 font-semibold",
            identityPreviewText: "text-gray-700 font-medium",
            identityPreviewEditButton: "text-violet-600 hover:text-violet-500",
          },
        }}
      />
    </div>
  );
}
