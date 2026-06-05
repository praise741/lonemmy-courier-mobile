import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the Super App Portal homepage instead of immediate login
  return <Redirect href="/(customer)/home" />;
}
