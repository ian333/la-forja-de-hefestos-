import la_pluma as L, numpy as np
rows=[]; data={}
cases=[("A2_lazo_rapido_sin_tope", dict(DMAX=0.95, DETECT=0, USEQ3=0, KP=0.012, KI=120.0)),
       ("B2_lazo_rapido_tope_0.22", dict(DMAX=0.22, DETECT=0, USEQ3=0, KP=0.012, KI=120.0)),
       ("G_pluma_90A_det_Q3", dict(DMAX=0.22, DETECT=1, USEQ3=1, ISET=90.0)),
       ("G0_pluma_90A_sin_Q3", dict(DMAX=0.22, DETECT=1, USEQ3=0, ISET=90.0))]
for name, over in cases:
    p=dict(L.BASE); p.update(over)
    d=L.run(name,p,L.DOT,L.T_RUPT); data[name]=d; L.report(name,d,L.T_RUPT,rows)
for r in rows:
    print(f"{r[0]:28s} Iprom={r[3]:5.1f} Ipico_toque={r[2]:5.1f} duty={r[5]:.3f} Vds_max={r[6]:5.1f} SWmin={r[7]:6.1f} kill={r[9]*1e3:.3f}ms I_puente@rupt={r[10]:5.1f} E_gota={r[11]*1e3:6.1f}mJ E_arco={r[12]*1e3:6.1f}mJ arco={r[13]*1e6:5.0f}us P_D1={r[15]:5.1f}W P_pluma={r[16]:5.1f}W P_in={r[17]:6.1f}W I_Q3max={r[18]:5.1f}")
L.trace("A2_lazo_rapido_sin_tope", data["A2_lazo_rapido_sin_tope"], 4.35e-3, 6.0e-3, 12)
L.trace("B2_lazo_rapido_tope_0.22", data["B2_lazo_rapido_tope_0.22"], 4.35e-3, 6.0e-3, 12)
