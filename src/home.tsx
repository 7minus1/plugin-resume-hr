import { useState } from "react"

const HomePage = () => {
  return (
    <div style={{
      padding: "24px",
      maxWidth: "1200px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#f5f7fa",
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
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px"
      }}>
        {/* 左侧面板 */}
        <div style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
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
            }}>简历解析结果</h2>
          </div>

          <div style={{
            backgroundColor: "#f3f4f6",
            padding: "16px",
            borderRadius: "6px",
            marginBottom: "16px"
          }}>
            <p style={{
              margin: 0,
              color: "#666"
            }}>请先上传简历文件，系统将自动进行智能分析</p>
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{
              padding: "16px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px"
            }}>
              <h3 style={{
                margin: "0 0 8px 0",
                fontSize: "16px",
                color: "#333"
              }}>基本信息</h3>
              <div style={{
                color: "#666",
                fontSize: "14px"
              }}>等待解析...</div>
            </div>

            <div style={{
              padding: "16px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px"
            }}>
              <h3 style={{
                margin: "0 0 8px 0",
                fontSize: "16px",
                color: "#333"
              }}>工作经历</h3>
              <div style={{
                color: "#666",
                fontSize: "14px"
              }}>等待解析...</div>
            </div>

            <div style={{
              padding: "16px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px"
            }}>
              <h3 style={{
                margin: "0 0 8px 0",
                fontSize: "16px",
                color: "#333"
              }}>教育背景</h3>
              <div style={{
                color: "#666",
                fontSize: "14px"
              }}>等待解析...</div>
            </div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px"
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
              fontWeight: 500
            }}>
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
              fontWeight: 500
            }}>
              立即咨询
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage 