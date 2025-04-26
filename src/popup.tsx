import { useState, useEffect } from "react"
import { getCurrentUser, isAuthenticated } from "./services/authService"
import { config } from './config/env'

const Popup = () => {
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [user, setUser] = useState<{ phoneNumber: string; username?: string; isVip?: boolean } | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const checkUser = async () => {
      console.log('Checking authentication status...');
      const isAuth = await isAuthenticated();
      console.log('Is authenticated:', isAuth);
      
      if (isAuth) {
        const currentUser = await getCurrentUser();
        console.log('Current user:', currentUser);
        if (currentUser) {
          setUser(currentUser);
        }
      } else {
        console.log('User is not authenticated');
        setUser(null);
      }
    };
    
    checkUser();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setError("请先登录后再上传文件");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploadStatus("") // 清除之前的提示信息
    }
  }

  const handleUpload = async () => {
    if (!user) {
      setError("请先登录后再上传文件");
      return;
    }
    if (!file) {
      setUploadStatus("请先选择文件")
      return
    }

    setIsUploading(true)
    setUploadStatus("正在入库...")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("deliveryChannel", "插件上传")
      formData.append("deliveryPosition", "未知岗位")

      // 获取认证令牌
      const result = await chrome.storage.local.get(['access_token']);
      const token = result.access_token;

      if (!token) {
        setError("请先登录");
        return;
      }

      const response = await fetch(`${config.API_BASE_URL}/resume/upload`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        mode: 'cors',
        body: formData
      })

      if (response.ok) {
        setUploadStatus("入库成功！")
        setFile(null) // 入库成功后清除文件
      } else {
        setUploadStatus("上传失败，请重试")
      }
    } catch (error) {
      setUploadStatus("上传出错：" + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const openHomePage = () => {
    chrome.tabs.create({ url: "tabs/home.html" })
  }

  return (
    <div style={{ 
      padding: "24px", 
      width: "320px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h2 style={{ 
          margin: 0,
          fontSize: "18px",
          color: "#333",
          fontWeight: 500
        }}>文件上传</h2>
        <button
          onClick={openHomePage}
          style={{
            padding: "6px 12px",
            backgroundColor: "transparent",
            color: "#ff4500",
            border: "1px solid #ff4500",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}>
          {user ? (
            <>
              <span style={{ 
                maxWidth: "120px", 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap" 
              }}>
                { user.phoneNumber}
              </span>
              <span>→</span>
            </>
          ) : (
            "未登录 →"
          )}
        </button>
      </div>
      
      <div style={{ 
        marginBottom: "20px",
        border: "2px dashed #ff4500",
        borderRadius: "8px",
        padding: "20px",
        textAlign: "center",
        backgroundColor: "#fff5f2",
        transition: "all 0.3s ease",
        cursor: user ? "pointer" : "not-allowed",
        opacity: user ? 1 : 0.7
      }}>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
          onChange={handleFileChange}
          style={{ 
            display: "none"
          }}
          id="fileInput"
          disabled={!user}
        />
        <label 
          htmlFor="fileInput"
          style={{
            display: "block",
            cursor: user ? "pointer" : "not-allowed",
            color: "#666"
          }}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              setError("请先登录后再上传文件");
            }
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            {file ? (
              <span style={{ color: "#ff4500", fontWeight: 500 }}>
                已选择: {file.name}
              </span>
            ) : (
              <span>点击或拖拽文件到此处</span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "#999" }}>
            支持 PDF、Word、图片格式
          </div>
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        style={{
          width: "100%",
          padding: "10px 16px",
          backgroundColor: !file || isUploading ? "#e0e0e0" : "#ff4500",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: !file || isUploading ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: 500,
          transition: "all 0.3s ease"
        }}
        onMouseOver={(e) => {
          if (!file || isUploading) return;
          e.currentTarget.style.backgroundColor = "#e63e00";
        }}
        onMouseOut={(e) => {
          if (!file || isUploading) return;
          e.currentTarget.style.backgroundColor = "#ff4500";
        }}>
        {isUploading ? "上传中..." : "上传文件"}
      </button>

      {error && (
        <div style={{
          marginTop: "12px",
          padding: "8px 12px",
          backgroundColor: "#fff5f2",
          color: "#ff4500",
          borderRadius: "4px",
          fontSize: "14px",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}

      {uploadStatus && !error && (
        <div style={{
          marginTop: "12px",
          padding: "8px 12px",
          backgroundColor: uploadStatus.includes("成功") ? "#fff5f2" : "#ffebee",
          color: uploadStatus.includes("成功") ? "#ff4500" : "#c62828",
          borderRadius: "4px",
          fontSize: "14px",
          textAlign: "center"
        }}>
          {uploadStatus}
        </div>
      )}
    </div>
  )
}

export default Popup