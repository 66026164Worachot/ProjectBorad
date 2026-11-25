// src/pages/Login.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Container, // <-- เพิ่ม
  Row,       // <-- เพิ่ม
  Col,       // <-- เพิ่ม
} from 'react-bootstrap';
import { authAPI } from '../services/api';
import { auth } from '../utils/auth';
import heroImage from '../assets/Login_img.png';
import Logo from '../assets/b_logo.svg';

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | register | reset
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [resetEmail, setResetEmail] = useState('');
  const [resetStage, setResetStage] = useState('request'); // request | confirm
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isResetRequestStage = isReset && resetStage === 'request';
  const isResetConfirmStage = isReset && resetStage === 'confirm';
  const gmailRegex = /^[^@\s]+@gmail\.com$/i;

  const primeResetForm = (emailValue = '') => {
    setResetStage('request');
    setResetCode('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetEmail(emailValue);
  };

  const handleResetEmailChange = (value) => {
    setResetEmail(value);
    setError('');
    if (resetStage !== 'request') {
      setResetStage('request');
      setResetCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setSuccess('');
    }
  };

  const validateResetEmail = () => {
    if (!resetEmail) {
      setError('❌ Please provide the Gmail address you registered with.');
      return false;
    }

    if (!gmailRegex.test(resetEmail)) {
      setError('❌ ตอนนี้ระบบรองรับเฉพาะอีเมลที่ลงท้ายด้วย @gmail.com');
      return false;
    }

    return true;
  };

  const redirectByRole = useCallback(
    (incomingRole) => {
      const role = incomingRole || auth.getUserInfo()?.role;

      if (role === 'user') {
        navigate('/user/home', { replace: true });
        return true;
      }

      if (role === 'manager' || role === 'staff') {
        navigate('/admin/dashboard', { replace: true });
        return true;
      }

      return false;
    },
    [navigate]
  );

  useEffect(() => {
    if (auth.isAuthenticated()) {
      redirectByRole();
    }
  }, [redirectByRole]);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const access = params.get('access');
    const refresh = params.get('refresh');
    const roleFromProvider = params.get('role');

    if (access && refresh) {
      auth.setTokens(access, refresh);
      setSuccess('Google login successful! Redirecting...');
      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        if (!redirectByRole(roleFromProvider)) {
          setError('Unable to determine your role from Google login response.');
        }
      }, 800);
    }
  }, [redirectByRole]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const switchMode = (nextMode) => {
    setError('');
    setSuccess('');
    setLoading(false);

    if (nextMode === 'reset') {
      primeResetForm(formData.email || resetEmail || '');
    } else {
      primeResetForm('');
    }

    if (nextMode === 'register' || nextMode === 'login') {
      setFormData((prev) => ({
        email: nextMode === 'login' ? (formData.email || resetEmail || prev.email) : prev.email,
        password: '',
        confirmPassword: '',
      }));
    }

    setMode(nextMode);
  };

  const requestResetCode = async (isResend = false) => {
    const response = await authAPI.requestPasswordReset(resetEmail);
    const messageFromApi = response.data?.message;

    setSuccess(
      messageFromApi ||
        (isResend
          ? '✅ ส่งรหัสใหม่ไปที่ Gmail ของคุณแล้ว'
          : '✅ ส่งรหัสยืนยันไปที่ Gmail ของคุณแล้ว กรุณาตรวจสอบภายใน 10 นาที')
    );
    setResetStage('confirm');
    setResetCode('');
    if (!isResend) {
      setResetNewPassword('');
      setResetConfirmPassword('');
    }

    return response;
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');

    if (!validateResetEmail()) {
      return;
    }

    setLoading(true);
    try {
      await requestResetCode(true);
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      setError(`❌ Password reset failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (isRegister && formData.password !== formData.confirmPassword) {
      setError('❌ Password confirmation does not match.');
      return;
    }

    if (isReset) {
      if (!validateResetEmail()) {
        return;
      }

      if (isResetConfirmStage) {
        const trimmedCode = resetCode.trim();
        if (!/^\d{6}$/.test(trimmedCode)) {
          setError('❌ กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลให้ถูกต้อง');
          return;
        }

        if (resetNewPassword.length < 6) {
          setError('❌ รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
          return;
        }

        if (resetNewPassword !== resetConfirmPassword) {
          setError('❌ ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
          return;
        }
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const response = await authAPI.login(formData.email, formData.password);

        if (response.data.ok) {
          const { access, refresh } = response.data.tokens;
          const userRole = response.data.user?.role;

          auth.setTokens(access, refresh);
          setSuccess('Login successful! Redirecting...');

          setTimeout(() => {
            if (!redirectByRole(userRole)) {
              setError('Your account does not have a supported role.');
            }
          }, 600);
        }
      } else if (isRegister) {
        const response = await authAPI.register(formData.email, formData.password);
        if (response.data.ok) {
          setSuccess('Registration successful! You can now login.');
          setMode('login');
          setFormData({ email: formData.email, password: '', confirmPassword: '' });
        }
      } else if (isReset) {
        if (isResetRequestStage) {
          await requestResetCode(false);
        } else if (isResetConfirmStage) {
          const trimmedCode = resetCode.trim();
          const response = await authAPI.confirmPasswordReset(resetEmail, trimmedCode, resetNewPassword);

          const emailForLogin = resetEmail;
          const confirmationMessage =
            response.data?.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้ทันที';

          if (response.data?.ok) {
            setSuccess(confirmationMessage);
            setMode('login');
            setFormData({ email: emailForLogin, password: '', confirmPassword: '' });
            primeResetForm('');
            return;
          }

          // หาก backend ไม่ส่ง ok:true แต่ไม่มี error ให้ถือว่าทำสำเร็จและให้ผู้ใช้ลองล็อกอิน
          setSuccess(confirmationMessage);
          setMode('login');
          setFormData({ email: emailForLogin, password: '', confirmPassword: '' });
          primeResetForm('');
          return;
        }
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      const label = isLogin ? 'Login' : isRegister ? 'Registration' : 'Password reset';
      setError(`❌ ${label} failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    authAPI.googleLogin();
  };

  return (
    <Container
      fluid
      className="vh-100 p-0"
      style={{
        backgroundColor: '#f9fafb',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <Row className="g-0 h-100">
        {/* === ฝั่งซ้าย (รูปภาพ) - ซ่อนบนมือถือ === */}
        <Col
          md={6}
          className="d-none d-md-flex align-items-center justify-content-center"
          style={{
            background: 'linear-gradient(135deg, #ff7e29, #ff944d)',
            borderTopRightRadius: '32px',
            borderBottomRightRadius: '32px',
            overflow: 'hidden',
          }}
        >
          <img
            src={heroImage}
            alt="Dashboard illustration"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Col>

        {/* === ฝั่งขวา (ฟอร์ม) - เต็มจอ C ม E=== */}
        <Col
          xs={12}
          md={6}
          className="d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: '#fff',
            padding: '40px',
          }}
        >
          <Card
            className="border-0 shadow-none"
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'transparent',
            }}
          >
            <Card.Body>
              <div className="text-center mb-4">
                <img src={Logo} alt="Project logo" style={{ width: 128, height: 128, objectFit: 'contain' }} />
                <h4 className="fw-bold mb-1">
                  {isLogin && 'Welcome Back'}
                  {isRegister && 'Create Account'}
                  {isReset && 'Reset Password'}
                </h4>
                <p className="text-muted small mb-0">
                  {isLogin && 'Please login to your account'}
                  {isRegister && 'Fill in your info to register'}
                  {isReset && 'Tell us the Gmail you used so we can send a verification code'}
                </p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="Gmail address"
                    value={isReset ? resetEmail : formData.email}
                    onChange={(event) => {
                      if (isReset) {
                        handleResetEmailChange(event.target.value);
                      } else {
                        handleChange(event);
                      }
                    }}
                    required
                    autoComplete="email"
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #ddd',
                      padding: '12px',
                    }}
                  />
                </Form.Group>

                {isReset && (
                  <p className="text-muted small" style={{ marginTop: '-8px' }}>
                    {isResetRequestStage
                      ? 'เราจะส่งรหัสยืนยัน 6 หลักไปยัง Gmail นี้เพื่อยืนยันว่าเป็นเจ้าของบัญชีจริง ๆ'
                      : 'กรอกรหัส 6 หลักจากอีเมล แล้วตั้งรหัสผ่านใหม่เพื่อปลดล็อกการเข้าสู่ระบบ'}
                  </p>
                )}

                {isResetConfirmStage && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        placeholder="รหัสยืนยัน 6 หลัก"
                        value={resetCode}
                        onChange={(event) => {
                          const onlyDigits = event.target.value.replace(/\D/g, '').slice(0, 6);
                          setResetCode(onlyDigits);
                        }}
                        required
                        autoComplete="one-time-code"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #ddd',
                          padding: '12px',
                          letterSpacing: '6px',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                      />
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <small className="text-muted">ไม่ได้รับรหัส?</small>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading}
                        style={{
                          color: '#ff7e29',
                          fontSize: '0.85rem',
                          background: 'none',
                          border: 'none',
                          fontWeight: 600,
                        }}
                      >
                        ส่งรหัสอีกครั้ง
                      </button>
                    </div>

                    <Form.Group className="mb-3">
                      <Form.Control
                        type="password"
                        name="resetNewPassword"
                        placeholder="รหัสผ่านใหม่"
                        value={resetNewPassword}
                        onChange={(event) => setResetNewPassword(event.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #ddd',
                          padding: '12px',
                        }}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Control
                        type="password"
                        name="resetConfirmPassword"
                        placeholder="ยืนยันรหัสผ่านใหม่"
                        value={resetConfirmPassword}
                        onChange={(event) => setResetConfirmPassword(event.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #ddd',
                          padding: '12px',
                        }}
                      />
                    </Form.Group>
                  </>
                )}

                {!isReset && (
                  <Form.Group className="mb-3">
                    <Form.Control
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #ddd',
                        padding: '12px',
                      }}
                    />
                  </Form.Group>
                )}

                {isRegister && (
                  <Form.Group className="mb-3">
                    <Form.Control
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #ddd',
                        padding: '12px',
                      }}
                    />
                  </Form.Group>
                )}

                {isLogin && (
                  <div className="text-end mb-3">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      style={{
                        color: '#ff7e29',
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-100 fw-semibold mb-3"
                  disabled={loading}
                  style={{
                    backgroundColor: '#ff7e29',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 0',
                    fontSize: '1rem',
                  }}
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </>
                  ) : isLogin ? (
                    'Login'
                  ) : isRegister ? (
                    'Register'
                  ) : isResetConfirmStage ? (
                    'เปลี่ยนรหัสผ่าน'
                  ) : (
                    'ส่งรหัสยืนยัน'
                  )}
                </Button>

                {isLogin && (
                  <>
                    <div className="text-center my-3" style={{ color: '#999', fontSize: '0.85rem' }}>
                      — Or Login with —
                    </div>

                    <div className="d-flex justify-content-between gap-2 mb-4">
                      <Button
                        variant="light"
                        className="flex-grow-1 border d-flex align-items-center justify-content-center gap-2"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{
                          borderRadius: '10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                        }}
                      >
                        <img
                          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                          alt="Google"
                          style={{ width: '18px', height: '18px' }}
                        />
                        Google
                      </Button>
                    </div>
                  </>
                )}

                <div className="text-center">
                  <small style={{ color: '#777' }}>
                    {isLogin && (
                      <>
                        Don’t have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('register')}
                          style={{
                            color: '#ff7e29',
                            fontWeight: '600',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          Signup
                        </button>
                      </>
                    )}
                    {isRegister && (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          style={{
                            color: '#ff7e29',
                            fontWeight: '600',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          Login
                        </button>
                      </>
                    )}
                    {isReset && (
                      <>
                        Remembered your password?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          style={{
                            color: '#ff7e29',
                            fontWeight: '600',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                          }}
                        >
                          Back to login
                        </button>
                      </>
                    )}
                  </small>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Login;