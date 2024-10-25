import { useSignIn, useSignUp } from "@clerk/nextjs";
import { OAuthStrategy } from "@clerk/types";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema } from "@/components/forms/sign-up/schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { onSignUpUser } from "@/actions/auth";

export const useGoogleAuth = () => {
  const { signIn, isLoaded: LoadedSignIn } = useSignIn();
  const { signUp, isLoaded: LoadedSignUp } = useSignUp();

  const signInWith = (strategy: OAuthStrategy) => {
    if (!LoadedSignIn) return;
    try {
      return signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/callback",
        redirectUrlComplete: "/callback/sign-in",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const signUpWith = (strategy: OAuthStrategy) => {
    if (!LoadedSignUp) return;
    try {
      return signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/callback",
        redirectUrlComplete: "/callback/complete",
      });
    } catch (error) {
      console.error(error);
    }
  };

  return { signUpWith, signInWith };
};

export const useAuthSignUp = () => {
  const { setActive, isLoaded, signUp } = useSignUp();
  const [creating, setCreating] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [code, setCode] = useState<string>("");

  const {
    register,
    formState: { errors },
    reset,
    handleSubmit,
    getValues,
  } = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    mode: "onBlur",
  });

  const router = useRouter();

  const onGenerateCode = async (email: string, password: string) => {
    if (!isLoaded)
      return toast("Error", {
        description: "Oops! something went wrong",
      });
    try {
      if (email && password) {
        await signUp.create({
          emailAddress: getValues("email"),
          password: getValues("password"),
        });

        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });

        setVerifying(true);
      } else {
        return toast("Error", {
          description: "No fields must be empty",
        });
      }
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
    }
  };

  const onInitiateUserRegistration = handleSubmit(async (values) => {
    if (!isLoaded)
      return toast("Error", {
        description: "Oops! something went wrong",
      });

    try {
      setCreating(true);
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status !== "complete") {
        return toast("Error", {
          description: "Oops! something went wrong, status incomplete",
        });
      }

      if (completeSignUp.status === "complete") {
        if (!signUp.createdUserId) return;
        const user = await onSignUpUser({
          firstname: values.firstname,
          lastname: values.lastname,
          clerkId: signUp.createdUserId,
          image: "",
        });

        reset();

        if (user.status === 200) {
          toast("Success", {
            description: user.message,
          });
          await setActive({
            session: completeSignUp.createdSessionId,
          });
          router.push(`/group/create`);
        }
        if (user.status !== 200) {
          toast("Error", {
            description: user.message + "action failed",
          });
          router.refresh();
        }
        setCreating(false);
        setVerifying(false);
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
    }
  });

  return {
    register,
    errors,
    onGenerateCode,
    onInitiateUserRegistration,
    verifying,
    creating,
    code,
    setCode,
    getValues,
  };
};
