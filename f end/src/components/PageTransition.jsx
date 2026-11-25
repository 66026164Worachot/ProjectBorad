import { motion } from "framer-motion";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -20,
  },
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3,
};

const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;

// Example usage in your pages (e.g. Home.jsx, Setting.jsx, etc.)
// import PageTransition from "../components/PageTransition";

// const YourComponent = () => {
//   return (
//     <PageTransition>
//       {/* Your existing component content */}
//     </PageTransition>
//   );
// };