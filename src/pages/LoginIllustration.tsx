/** 装饰插画使用主题变量，与登录页一起响应明暗模式。 */
export function LoginIllustration() {
  return (
    <svg className="login-illustration my-5 w-full overflow-visible" viewBox="0 0 520 310" fill="none"
         aria-hidden="true">
      <ellipse cx="262" cy="168" rx="216" ry="122" fill="hsl(var(--primary) / .035)"/>
      <ellipse cx="262" cy="168" rx="194" ry="101" stroke="hsl(var(--primary) / .13)" strokeDasharray="3 8"/>
      <path className="login-flow" d="M76 104H130Q145 104 145 119V228Q145 242 160 242H388Q405 242 405 225V158"
            stroke="hsl(var(--primary) / .5)" strokeWidth="1.5" strokeDasharray="5 7"/>
      <path className="login-flow" d="M214 68V46Q214 32 230 32H396Q412 32 412 48V84" stroke="hsl(var(--primary) / .3)"
            strokeWidth="1.5" strokeDasharray="5 7"/>

      <g className="login-float-main">
        <rect x="111" y="80" width="280" height="174" rx="13" fill="hsl(var(--primary) / .06)"
              transform="rotate(-5 251 167)"/>
        <rect x="112" y="70" width="280" height="174" rx="12" className="login-svg-card"/>
        <path d="M112 108H392" stroke="hsl(var(--border))"/>
        <rect x="127" y="82" width="22" height="15" rx="4" fill="hsl(var(--primary) / .12)"/>
        <path d="M133 86H143M133 90H140" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round"/>
        <text x="158" y="94" className="login-svg-text" fontSize="10" fontWeight="600">我的业务应用</text>
        <circle cx="367" cy="89" r="3" fill="hsl(var(--primary) / .25)"/>
        <circle cx="377" cy="89" r="3" fill="hsl(var(--primary) / .5)"/>
        <rect x="126" y="121" width="65" height="109" rx="5" fill="hsl(var(--muted) / .7)"/>
        <rect x="133" y="129" width="51" height="17" rx="3" fill="hsl(var(--primary) / .12)"/>
        {[157, 176, 195].map(y => <rect key={y} x="136" y={y} width="36" height="4" rx="2"
                                        fill="hsl(var(--muted-foreground) / .18)"/>)}
        <rect x="203" y="123" width="62" height="6" rx="3" fill="hsl(var(--foreground) / .6)"/>
        <rect x="339" y="119" width="37" height="15" rx="4" fill="hsl(var(--primary))"/>
        <path d="M354 126H361M357.5 122.5V129.5" stroke="hsl(var(--primary-foreground))" strokeLinecap="round"/>
        <rect x="203" y="145" width="173" height="21" rx="3" fill="hsl(var(--muted))"/>
        {[178, 198, 218].map((y, i) => <g key={y}>
          <rect x="208" y={y - 4} width="7" height="7" rx="2" stroke="hsl(var(--border))"/>
          <rect x="224" y={y - 3} width={45 + i * 8} height="4" rx="2" fill="hsl(var(--muted-foreground) / .22)"/>
          <rect x="294" y={y - 3} width="27" height="4" rx="2" fill="hsl(var(--muted-foreground) / .14)"/>
          <rect x="342" y={y - 6} width="25" height="10" rx="5" fill="hsl(var(--primary) / .12)"/>
        </g>)}
        <path d="M214 155H248M279 155H310M341 155H364" stroke="hsl(var(--muted-foreground) / .3)" strokeWidth="3"
              strokeLinecap="round"/>
      </g>

      <g className="login-float-back">
        <rect x="30" y="64" width="112" height="78" rx="11" className="login-svg-card"/>
        <rect x="44" y="78" width="26" height="26" rx="7" fill="hsl(var(--primary) / .1)"/>
        <path d="M51 87H63M51 91H59M51 95H61" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round"/>
        <text x="80" y="88" className="login-svg-text" fontSize="10">数据表单</text>
        <rect x="80" y="96" width="44" height="4" rx="2" fill="hsl(var(--muted-foreground) / .2)"/>
        <path d="M45 119H78M85 119H122" stroke="hsl(var(--primary) / .2)" strokeWidth="5" strokeLinecap="round"/>
      </g>

      <g className="login-float-front">
        <rect x="345" y="175" width="148" height="79" rx="12" className="login-svg-card"/>
        <circle cx="370" cy="200" r="11" fill="hsl(var(--primary) / .12)"/>
        <path d="M365 200L368 203L375 196" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round"/>
        <text x="390" y="198" className="login-svg-text" fontSize="10" fontWeight="600">协作，从此顺畅</text>
        <rect x="390" y="205" width="73" height="4" rx="2" fill="hsl(var(--muted-foreground) / .2)"/>
        <path d="M364 233H474" stroke="hsl(var(--border))" strokeWidth="3" strokeLinecap="round"/>
        <path className="login-progress" d="M364 233H447" stroke="hsl(var(--primary))" strokeWidth="3"
              strokeLinecap="round"/>
      </g>

      <g className="login-orbit">
        <rect x="382" y="53" width="52" height="52" rx="14" fill="hsl(var(--primary))"/>
        <path d="M395 67H404V76H395ZM412 67H421V76H412ZM395 84H404V93H395ZM412 84H421V93H412Z"
              fill="hsl(var(--primary-foreground))" fillOpacity=".9"/>
      </g>
      <circle className="login-dot" cx="81" cy="216" r="5" fill="hsl(var(--primary) / .4)"/>
      <circle cx="317" cy="35" r="3" fill="hsl(var(--primary) / .3)"/>
      <path d="M461 131V143M455 137H467M179 272V282M174 277H184" stroke="hsl(var(--primary) / .35)" strokeWidth="2"
            strokeLinecap="round"/>
    </svg>
  )
}
