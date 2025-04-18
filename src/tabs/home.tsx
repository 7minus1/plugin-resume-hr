import { useState, useEffect } from "react"
import "./home.css"
import { login, register, getUserProfile, logout, getBitableInfo, updateBitableInfo } from "../services/authService"
import styled from "@emotion/styled"

const Modal = styled.div<{ isOpen: boolean }>`
  display: ${props => props.isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
  padding: 4px;
  &:hover {
    color: #333;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  color: #4b5563;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #7c3aed;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background-color: ${props => props.variant === 'secondary' ? '#e5e7eb' : '#7c3aed'};
  color: ${props => props.variant === 'secondary' ? '#4b5563' : 'white'};
  &:hover {
    opacity: 0.9;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 8px 16px;
  border: none;
  background: none;
  color: ${props => props.active ? '#7c3aed' : '#6b7280'};
  border-bottom: 2px solid ${props => props.active ? '#7c3aed' : 'transparent'};
  cursor: pointer;
  font-weight: ${props => props.active ? '500' : 'normal'};
  &:hover {
    color: #7c3aed;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
`;

const UserName = styled.span`
  color: #4b5563;
  font-size: 14px;
`;

const BitableForm = styled.form`
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #f9fafb;
`;

const BitableTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const BitableTitleText = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const BitableEditButton = styled.button`
  padding: 4px 12px;
  background-color: transparent;
  color: #7c3aed;
  border: 1px solid #7c3aed;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background-color: #f3e8ff;
  }
`;

const BitableInput = styled.input<{ readOnly?: boolean }>`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 12px;
  background-color: ${props => props.readOnly ? '#f3f4f6' : 'white'};
  color: ${props => props.readOnly ? '#6b7280' : '#111827'};
  cursor: ${props => props.readOnly ? 'default' : 'text'};
  &:focus {
    outline: none;
    border-color: #7c3aed;
  }
`;

const BitableButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  background-color: #7c3aed;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  &:hover {
    background-color: #6d28d9;
  }
  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`;

const BitableInfo = styled.div`
  margin-bottom: 12px;
`;

const BitableLabel = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
`;

const BitableValue = styled.div`
  font-size: 14px;
  color: #111827;
  word-break: break-all;
`;

const HomePage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    verificationCode: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [bitableInfo, setBitableInfo] = useState<{
    bitableUrl: string;
    bitableToken: string;
  }>({
    bitableUrl: '',
    bitableToken: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempBitableInfo, setTempBitableInfo] = useState({
    bitableUrl: '',
    bitableToken: ''
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (user) {
      loadBitableInfo();
    }
  }, [user]);

  const checkAuthStatus = async () => {
    try {
      const result = await chrome.storage.local.get(['access_token', 'user']);
      const token = result.access_token;
      const userStr = result.user;
      
      if (token && userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser(userData);
        } catch (error) {
          console.error('解析用户数据失败:', error);
          await chrome.storage.local.remove(['access_token', 'user']);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      await chrome.storage.local.remove(['access_token', 'user']);
      setUser(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await login({
        email: formData.email,
        password: formData.password
      });
      setIsLoginModalOpen(false);
      setUser(response.user);
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败，请检查邮箱和密码');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }
    try {
      await register({
        email: formData.email,
        password: formData.password,
        username: formData.username || undefined
      });
      setIsRegisterModalOpen(false);
      alert('注册成功，请登录');
    } catch (error) {
      console.error('注册失败:', error);
      alert('注册失败，请重试');
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  const loadBitableInfo = async () => {
    try {
      const info = await getBitableInfo();
      if (info) {
        setBitableInfo({
          bitableUrl: info.bitableUrl,
          bitableToken: info.bitableToken
        });
        setTempBitableInfo({
          bitableUrl: info.bitableUrl,
          bitableToken: info.bitableToken
        });
      }
    } catch (error) {
      console.error('获取多维表格信息失败:', error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setTempBitableInfo({ ...bitableInfo });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setTempBitableInfo({ ...bitableInfo });
    setSaveStatus('');
  };

  const handleBitableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('');

    try {
      await updateBitableInfo(tempBitableInfo);
      setBitableInfo(tempBitableInfo);
      setSaveStatus('保存成功');
      setIsEditing(false);
    } catch (error) {
      console.error('更新多维表格信息失败:', error);
      setSaveStatus('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBitableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTempBitableInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f5f7fa",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh"
      }}>
        <header style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "24px"
        }}>
          <h1 style={{
            margin: 0,
            fontSize: "24px",
            color: "#333",
            fontWeight: 500
          }}>AI简历解析</h1>
          
          <UserInfo>
            {user ? (
              <>
                <UserName>欢迎，{user.username || user.email}</UserName>
                <Button variant="secondary" onClick={handleLogout}>登出</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsLoginModalOpen(true)} style={{ marginRight: '8px' }}>登录</Button>
                <Button onClick={() => setIsRegisterModalOpen(true)}>注册</Button>
              </>
            )}
          </UserInfo>
        </header>

        <div className="grid-layout">
          {/* 左侧面板 */}
          <div style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            height: "fit-content"
          }}>
            <div style={{
              borderLeft: "4px solid #7c3aed",
              paddingLeft: "12px",
              marginBottom: "20px"
            }}>
              <h2 style={{
                margin: 0,
                fontSize: "18px",
                color: "#333"
              }}>简历解析</h2>
            </div>

            {user ? (
              <BitableForm onSubmit={handleBitableSubmit}>
                <BitableTitle>
                  <BitableTitleText>多维表格配置</BitableTitleText>
                  {!isEditing && (
                    <BitableEditButton type="button" onClick={handleEdit}>
                      编辑
                    </BitableEditButton>
                  )}
                </BitableTitle>

                {isEditing ? (
                  <>
                    <BitableInput
                      type="url"
                      name="bitableUrl"
                      value={tempBitableInfo.bitableUrl}
                      onChange={handleBitableChange}
                      placeholder="请输入多维表格链接"
                      required
                    />
                    <BitableInput
                      type="text"
                      name="bitableToken"
                      value={tempBitableInfo.bitableToken}
                      onChange={handleBitableChange}
                      placeholder="请输入多维表格授权码"
                      required
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <BitableButton type="submit" disabled={isSaving} style={{ flex: 1 }}>
                        {isSaving ? '保存中...' : '保存'}
                      </BitableButton>
                      <BitableButton 
                        type="button" 
                        onClick={handleCancel}
                        style={{ 
                          flex: 1,
                          backgroundColor: '#e5e7eb',
                          color: '#374151'
                        }}
                      >
                        取消
                      </BitableButton>
                    </div>
                  </>
                ) : (
                  <>
                    <BitableInfo>
                      <BitableLabel>多维表格链接</BitableLabel>
                      <BitableValue>{bitableInfo.bitableUrl || '未设置'}</BitableValue>
                    </BitableInfo>
                    <BitableInfo>
                      <BitableLabel>多维表格授权码</BitableLabel>
                      <BitableValue>
                        {bitableInfo.bitableToken ? '••••••••' : '未设置'}
                      </BitableValue>
                    </BitableInfo>
                  </>
                )}

                {saveStatus && (
                  <p style={{
                    margin: '8px 0 0 0',
                    fontSize: '14px',
                    color: saveStatus.includes('成功') ? '#059669' : '#dc2626',
                    textAlign: 'center'
                  }}>
                    {saveStatus}
                  </p>
                )}
              </BitableForm>
            ) : (
              <div style={{
                backgroundColor: "#f3f4f6",
                padding: "16px",
                borderRadius: "6px",
                marginBottom: "16px"
              }}>
                <p style={{
                  margin: 0,
                  color: "#666"
                }}>请先登录以配置多维表格</p>
              </div>
            )}

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "20px"
            }}>
              {["基本信息", "工作经历", "教育背景"].map((title, index) => (
                <div key={index} style={{
                  padding: "16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px"
                }}>
                  <h3 style={{
                    margin: "0 0 8px 0",
                    fontSize: "16px",
                    color: "#333"
                  }}>{title}</h3>
                  <div style={{
                    color: "#666",
                    fontSize: "14px"
                  }}>等待解析...</div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧面板 */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            height: "fit-content"
          }}>
            {/* 会员卡片 */}
            <div style={{
              backgroundColor: "#f3e8ff",
              borderRadius: "8px",
              padding: "24px",
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{
                display: "inline-block",
                padding: "4px 12px",
                backgroundColor: "#7c3aed",
                color: "white",
                borderRadius: "4px",
                fontSize: "14px",
                marginBottom: "16px"
              }}>
                高级标准版
              </div>

              <div style={{
                fontSize: "32px",
                fontWeight: "bold",
                color: "#333",
                marginBottom: "24px"
              }}>
                ¥99.00 <span style={{ fontSize: "14px", fontWeight: "normal" }}>/人/年</span>
              </div>

              <ul style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                marginBottom: "24px"
              }}>
                {[
                  "智能解析简历关键信息",
                  "同步飞书多维度管理",
                  "AI评估推荐优质候选人"
                ].map((feature, index) => (
                  <li key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                    color: "#4b5563",
                    fontSize: "14px"
                  }}>
                    <span style={{
                      width: "6px",
                      height: "6px",
                      backgroundColor: "#7c3aed",
                      borderRadius: "50%",
                      marginRight: "8px"
                    }}></span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                transition: "background-color 0.3s ease"
              }}
              className="purple-button">
                立即购买
              </button>
            </div>

            {/* 企业版卡片 */}
            <div style={{
              backgroundColor: "#e0f2fe",
              borderRadius: "8px",
              padding: "24px"
            }}>
              <div style={{
                display: "inline-block",
                padding: "4px 12px",
                backgroundColor: "#0284c7",
                color: "white",
                borderRadius: "4px",
                fontSize: "14px",
                marginBottom: "16px"
              }}>
                企业旗舰版
              </div>

              <div style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#333",
                marginBottom: "24px"
              }}>
                企业定制
                <div style={{
                  fontSize: "14px",
                  color: "#666",
                  fontWeight: "normal",
                  marginTop: "4px"
                }}>
                  不限用户数
                </div>
              </div>

              <ul style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                marginBottom: "24px"
              }}>
                {[
                  "智能解析简历关键信息",
                  "全流程智能协同招聘管理",
                  "AI面试智能评估辅助决策"
                ].map((feature, index) => (
                  <li key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                    color: "#4b5563",
                    fontSize: "14px"
                  }}>
                    <span style={{
                      width: "6px",
                      height: "6px",
                      backgroundColor: "#0284c7",
                      borderRadius: "50%",
                      marginRight: "8px"
                    }}></span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#0284c7",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                transition: "background-color 0.3s ease"
              }}
              className="blue-button">
                立即咨询
              </button>
            </div>
          </div>
        </div>

        {/* 登录模态框 */}
        <Modal isOpen={isLoginModalOpen}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>用户登录</ModalTitle>
              <CloseButton onClick={() => setIsLoginModalOpen(false)}>×</CloseButton>
            </ModalHeader>

            <Form onSubmit={handleLogin}>
              <FormGroup>
                <Label>邮箱</Label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>密码</Label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <Button type="submit">登录</Button>
            </Form>
          </ModalContent>
        </Modal>

        {/* 注册模态框 */}
        <Modal isOpen={isRegisterModalOpen}>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>用户注册</ModalTitle>
              <CloseButton onClick={() => setIsRegisterModalOpen(false)}>×</CloseButton>
            </ModalHeader>

            <Form onSubmit={handleRegister}>
              <FormGroup>
                <Label>邮箱 <span style={{ color: '#ef4444' }}>*</span></Label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>用户名 <span style={{ color: '#6b7280', fontSize: '12px' }}>(可选)</span></Label>
                <Input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="请输入用户名（选填）"
                />
              </FormGroup>
              <FormGroup>
                <Label>密码 <span style={{ color: '#ef4444' }}>*</span></Label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>确认密码 <span style={{ color: '#ef4444' }}>*</span></Label>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                />
                {passwordError && (
                  <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {passwordError}
                  </span>
                )}
              </FormGroup>
              <Button type="submit">注册</Button>
            </Form>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
};

export default HomePage 