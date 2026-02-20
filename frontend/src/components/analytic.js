import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { Row, Col, Typography, Image, Form, Space, Progress } from 'antd';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models, Report, Embed, service, Page } from 'powerbi-client';
import 'powerbi-report-authoring';
import { getTokenPowerBI, GetAllReports } from "../core/data_connecter/api_caller";
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { width } from "@mui/system";
import InputLabel from '@mui/material/InputLabel';
const Analytic = () => {
  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);

  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])
  const [tokenBI, setTokenBI] = React.useState("")
  const [reports, setReports] = React.useState([])
  const [sampleReportConfig, setSampleReportConfig] = React.useState(
    {
      type: "report",
      //id: '752ba17f-0f00-43ea-b203-eb7e5b73c21f',
      // embedUrl: "https://app.powerbi.com/reportEmbed?reportId=752ba17f-0f00-43ea-b203-eb7e5b73c21f&groupId=c0dcf1b0-02b5-4e82-9321-aa6e8ce1cc25&w=2&config=eyJjbHVzdGVyVXJsIjoiaHR0cHM6Ly9XQUJJLVdFU1QtRVVST1BFLUItUFJJTUFSWS1yZWRpcmVjdC5hbmFseXNpcy53aW5kb3dzLm5ldCIsImVtYmVkRmVhdHVyZXMiOnsibW9kZXJuRW1iZWQiOnRydWV9fQ%3d%3d",
      //embedUrl: "https://app.powerbi.com/view?r=eyJrIjoiMzRiODdjOTgtODc0My00MDcyLTk3MDUtNjQ4MjkxMzJiY2RkIiwidCI6ImRiNWRlZjZiLThmZDgtNGEzZS05MWRjLThkYjI1MDFhNjgyMiIsImMiOjEwfQ%3D%3D&pageName=ReportSection",
      //embedUrl: "https://app.powerbi.com/view?r=eyJrIjoiMmI4NWQ1MDAtNDUxOC00NzUwLWIzNWUtN2FlZDBjYzU4MWY0IiwidCI6ImRiNWRlZjZiLThmZDgtNGEzZS05MWRjLThkYjI1MDFhNjgyMiIsImMiOjEwfQ%3D%3D",
      accessToken: '',
      tokenType: models.TokenType.Aad,
      //tokenType: models.TokenType.Embed,

    })

  useEffect(() => {
    getTokenPowerBI()
      .then((res) => {
        const data = res?.data || {};
        console.log(data);
        setTokenBI(data?.access_token)
        GetAllReports(data?.access_token)
          .then((res3) => {
            const data3 = res3?.data || {}
            console.log(data3)
            setReports(data3?.value)
          }).catch(err => console.error(err))
        // setSampleReportConfig(
        //   { ...sampleReportConfig, accessToken: data?.access_token }
        // )
      })
  }, [])

  function Iframe(props) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: props.iframe ? props.iframe : "" }}
      />
    );
  }

  // Map of event handlers to be applied to the embedding report
  const eventHandlersMap = new Map([
    ['loaded', function () {
      console.log('Report loaded');
    }],
    ['rendered', function () {
      console.log('Report rendered');
    }],
    ['error', function (event) {
      console.log(event.detail);
    }]
  ])

  const handlerReport = (e) => {
    console.log(e?.target?.value)
    if (e?.target?.value) {
      let ReportId = e?.target?.value
      let findReport = reports.find((e) => {
        if (e?.id == ReportId) {
          return e
        }
      })
      console.log(findReport)
      getTokenPowerBI()
        .then((res) => {
          const data = res?.data || {};
          console.log(data);
          setTokenBI(data?.access_token)
          setSampleReportConfig(
            {
              ...sampleReportConfig,
              accessToken: data?.access_token,
              //type:findReport?.reportType,
              //embedUrl: "https://app.powerbi.com/view?r=eyJrIjoiMmI4NWQ1MDAtNDUxOC00NzUwLWIzNWUtN2FlZDBjYzU4MWY0IiwidCI6ImRiNWRlZjZiLThmZDgtNGEzZS05MWRjLThkYjI1MDFhNjgyMiIsImMiOjEwfQ%3D%3D",
              id: findReport?.id,
              //embedUrl: "https://app.powerbi.com/view?r=eyJrIjoiMmI4NWQ1MDAtNDUxOC00NzUwLWIzNWUtN2FlZDBjYzU4MWY0IiwidCI6ImRiNWRlZjZiLThmZDgtNGEzZS05MWRjLThkYjI1MDFhNjgyMiIsImMiOjEwfQ%3D%3D",
              embedUrl: findReport?.embedUrl
            }
          )
        })


    }
  }

  useEffect(() => {
    console.log(sampleReportConfig)
  }, [sampleReportConfig])

  return (
    <div className="analytic-div" style={{ maxWidth: "100%", maxHeight: '100%' }}>
      {/* <div>Data Analytic</div> */}
      {/* <Iframe iframe={'<iframe src="https://smartcity.nida.ac.th/grafana/d/amwUtb1Gz/iva-analytics-stats?orgId=1&refresh=10s&var-sel_floor=FL02&theme=light&from=1648388336327&to=1648409936327" allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media" style="width:100%; border:0; border-radius: 4px; overflow:hidden;" sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"></iframe>'}/> */}
      <Row style={{ width: '100%', padding: 10, justifyContent: 'center' }}>
        <FormControl sx={{ width: '50%' }} >
          <InputLabel id="demo-simple-select-label">รายงาน</InputLabel>
          <Select
            style={{ fontFamily: 'Sarabun', fontSize: '18px' }}
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            label={'รายงาน'}
            //labelId="demo-simple-select-label"
            //id="demo-simple-select"
            onChange={handlerReport}
          >
            {reports?.map((e) => {
              return <MenuItem value={e?.id}>{e?.name}</MenuItem>
            })}
            {/* <MenuItem value={"Water"}>Water Consumption</MenuItem> */}
          </Select>
        </FormControl>
      </Row>

      <PowerBIEmbed
        embedConfig={sampleReportConfig}
        eventHandlers={eventHandlersMap}
        cssClassName={"report-style-class"}
        getEmbeddedComponent={
          (embeddedReport) => {
            window.report = embeddedReport;
          }
        }

      />

    </div>
  )
}

export default Analytic;
