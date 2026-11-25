import { Link } from 'react-router-dom';
import { Container, Button } from 'react-bootstrap';
import { auth } from '../../utils/auth';

function Home() {
  const isLoggedIn = auth.isAuthenticated();

  return (
    <Container className="text-center py-5">
      <h1 className="display-4 mb-4">🚀 JWT OAuth Starter</h1>
      <p className="lead mb-4">
        Full-stack authentication with JWT + OAuth 2.0
      </p>
      
      {isLoggedIn ? (
        <Button as={Link} to="/admin/dashboard" variant="primary" size="lg">
          Go to Dashboard
        </Button>
      ) : (
        <Button as={Link} to="/login" variant="primary" size="lg">
          Get Started
        </Button>
      )}
    </Container>
  );
}

export default Home;