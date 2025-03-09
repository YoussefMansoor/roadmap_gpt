import "./global.css";

export const metadata = {
  title: "Roadmap GPT",
  description: "The place to go for all your student roadmap questions!",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;